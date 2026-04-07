
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Translation, AccountTab, PartnerSummary, LabourSummary, StoredAccount, AccountType, LabourTimelineRow, StockMovement, CustomerSummary, CustomerLedgerItem, SupplierSummary, SupplierLedgerItem, TransactionType, Language, ManualAdjustment, OwnerPreviousEntry } from '../../types';
import { AccountPageView } from './AccountPage.view';
import { formatMonthYear, getDatesInRange, formatISODateLocal } from '../../utils';
import { PDFGenerator } from '../../services/pdfGenerator';
import { SettingsService } from '../../services/settings.service';

interface AccountPageControllerProps {
  transactions: Transaction[];
  stockMovements?: StockMovement[]; 
  t: Translation;
  accounts: StoredAccount[];
  /** Hidden from Ledgers list only; does not delete underlying data. */
  hiddenLedgerAccountNames?: string[];
  onAddAccount: (name: string, type: AccountType, rate?: number) => void;
  onUpdateAccount: (account: StoredAccount) => void;
  onOpenTransactionModal: (mode: TransactionType, defaults?: { category?: string, accountName?: string }) => void;
  initialTab?: AccountTab;
  getTranslated: (text?: string) => string;
  
  // Specific Handlers
  onToggleAttendance?: (accountName: string, date: string, isPresent: boolean | null) => void;
  onToggleHisaab?: (accountName: string, date: string, isHisaab: boolean) => void;
  onAddAdjustment?: (accountName: string, adj: {date: string, amount: number, note: string}) => void;
  onUpdateAdjustment?: (adj: ManualAdjustment) => void;
  onDeleteAdjustment?: (id: number) => void;
  onRenameAccount?: (oldName: string, newName: string) => void;
  onDeleteAccount?: (accountName: string) => void;
  removedAccounts?: StoredAccount[];
  onRestoreAccount?: (account: StoredAccount) => void;
  onDeleteRemovedAccount?: (accountName: string) => void;

  onAddOwnerPreviousEntry?: (accountName: string, entry: Omit<OwnerPreviousEntry, 'id'>) => void;
  onUpdateOwnerPreviousEntry?: (accountName: string, entry: OwnerPreviousEntry) => void;
  onDeleteOwnerPreviousEntry?: (accountName: string, id: number) => void;
}

export const AccountPageController: React.FC<AccountPageControllerProps> = ({ 
  transactions, 
  stockMovements = [], 
  t, 
  accounts,
  hiddenLedgerAccountNames = [],
  onAddAccount,
  onUpdateAccount,
  onOpenTransactionModal,
  initialTab = 'labour',
  getTranslated,
  
  onToggleAttendance,
  onToggleHisaab,
  onAddAdjustment,
  onUpdateAdjustment,
  onDeleteAdjustment,
  onRenameAccount,
  onDeleteAccount,
  removedAccounts = [],
  onRestoreAccount,
  onDeleteRemovedAccount,

  onAddOwnerPreviousEntry,
  onUpdateOwnerPreviousEntry,
  onDeleteOwnerPreviousEntry
}) => {
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);

  // LABOUR: Date Range State (Default: Current Month)
  const [labourStartDate, setLabourStartDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [labourEndDate, setLabourEndDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  );

  // PDF / Report Date Ranges
  const [reportStartDate, setReportStartDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [reportEndDate, setReportEndDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  );
  
  // PDF Language State
  const [pdfLanguage, setPdfLanguage] = useState<Language>('en');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountRate, setNewAccountRate] = useState<string>('400'); // Default rate

  // Custom Serial Order State
  const [accountOrder, setAccountOrder] = useState<Record<string, number>>({});

  // Load Order on Mount
  useEffect(() => {
      SettingsService.get('accountOrderMap').then(data => {
          if (data) setAccountOrder(data);
      });
  }, []);

  const handleUpdateSerial = async (name: string, serial: number) => {
      const newOrder = { ...accountOrder, [name]: serial };
      setAccountOrder(newOrder);
      await SettingsService.set('accountOrderMap', newOrder);
  };

  // Effect to sync initialTab if changed from parent
  useEffect(() => {
      setActiveTab(initialTab);
      setSelectedAccountName(null);
  }, [initialTab]);

  // --- Logic: Derive Account Balances & Merge with Registered List ---
  
  const accountMap = useMemo(() => {
     const map = new Map<string, { type: AccountTab; balance: number }>();

     // 1. Initialize with all registered accounts
     accounts.forEach(acc => {
         const type = acc.type.toLowerCase();
         let tabType: AccountTab = 'customer'; // default fallback
         let initialBalance = 0;

         if (type === 'labour') {
             tabType = 'labour';
             // For Labour: Balance = Total Wages + Adjustments (We subtract payments later)
             const rate = acc.rate || 0;
             // Only count explicit presence (true) for wages
             const presentDays = acc.attendance ? Object.values(acc.attendance).filter(v => v === true).length : 0;
             const totalWages = presentDays * rate;
             const totalAdjustments = acc.manualAdjustments ? acc.manualAdjustments.reduce((sum, a) => sum + a.amount, 0) : 0;
             initialBalance = totalWages + totalAdjustments;
         }
         else if (type === 'partner') {
             tabType = 'partner';
             const prev = acc.ownerPreviousEntries || [];
             const prevIn = prev.filter(e => e.kind === 'received').reduce((s, e) => s + e.amount, 0);
             const prevOut = prev.filter(e => e.kind === 'paid').reduce((s, e) => s + e.amount, 0);
             initialBalance = prevIn - prevOut;
         }
         else if (type === 'supplier') {
             tabType = 'supplier';
             initialBalance = 0;
         }
         else {
             // Customer or others
             tabType = 'customer';
             initialBalance = 0;
         }
         
         map.set(acc.name, { type: tabType, balance: initialBalance });
     });

     // 2. Compute balances from transactions (General view)
     transactions.forEach(tr => {
        if (!tr.accountName) return;

        // Self-Healing: Create entry if missing
        if (!map.has(tr.accountName)) {
            let inferredType: AccountTab = 'customer';
            if (tr.category === 'labour') inferredType = 'labour';
            else if (tr.category === 'partner') inferredType = 'partner';
            else if (tr.category === 'supplier') inferredType = 'supplier';
            
            map.set(tr.accountName, { type: inferredType, balance: 0 });
        }

        const current = map.get(tr.accountName)!;

        // Apply Logic Based on Account Type
        if (current.type === 'labour') {
            // Labour Balance = Payable Amount
            // Expense (Payment) REDUCES Payable
            // Income INCREASES Payable (Recovery/Return) - Rare but mathematically consistent with Ledger
            if (tr.type === 'expense') current.balance -= tr.amount;
            else if (tr.type === 'income') current.balance += tr.amount;
        } 
        else if (current.type === 'partner') {
             // Partner Balance = Net Investment
             // Income (Invest) INCREASES Balance
             // Expense (Withdraw) DECREASES Balance
             if (tr.type === 'income') current.balance += tr.amount;
             else if (tr.type === 'expense') current.balance -= tr.amount;
        }
        else if (current.type === 'customer') {
             // Customer Balance = Net Receivable (Debtors)
             // Income (Payment Received) REDUCES Receivable
             // Expense (Refund) INCREASES Receivable
             if (tr.type === 'income') current.balance -= tr.amount;
             else if (tr.type === 'expense') current.balance += tr.amount;
        }
        else if (current.type === 'supplier') {
             // Supplier Balance = Net Paid (Advance/Paid)
             // Expense (Payment Made) INCREASES Net Paid
             // Income (Refund) DECREASES Net Paid
             // Note: Detailed View shows "Net Paid Balance".
             if (tr.type === 'expense') current.balance += tr.amount;
             else if (tr.type === 'income') current.balance -= tr.amount;
        }
     });

     // 3. Process Stock Movements (Critical for Customers)
     stockMovements.forEach(m => {
        if (!m.accountName) return;

        // Self-Healing
        if (!map.has(m.accountName)) {
             map.set(m.accountName, { type: 'customer', balance: 0 });
        }

        const current = map.get(m.accountName)!;

        // Only Customer accounts use Stock Out for billing (Receivable)
        if (current.type === 'customer' && m.type === 'out') {
             // Stock Out (Bill) INCREASES Receivable
             const amount = m.totalAmount || 0;
             current.balance += amount;
        }
     });

     return map;
  }, [transactions, accounts, stockMovements]);


  // 2. Prepare List Data for the active tab (SORTED by Custom Serial)
  const hiddenSet = useMemo(
    () => new Set(hiddenLedgerAccountNames.map(n => n.trim().toLowerCase())),
    [hiddenLedgerAccountNames]
  );

  const accountList = useMemo(() => {
     return Array.from(accountMap.entries())
        .filter(([name, data]) => {
           const matchesType = data.type === activeTab;
           const matchesSearch = getTranslated(name).toLowerCase().includes(searchQuery.toLowerCase()) || name.toLowerCase().includes(searchQuery.toLowerCase());
           const notHidden = !hiddenSet.has(name.trim().toLowerCase());
           return matchesType && matchesSearch && notHidden;
        })
        .map(([name, data]) => ({ 
            name, 
            balance: data.balance,
            serial: accountOrder[name] // May be undefined
        }))
        .sort((a, b) => {
            // Sort by Serial if both exist
            if (a.serial !== undefined && b.serial !== undefined) return a.serial - b.serial;
            // If only 'a' has serial, it comes first
            if (a.serial !== undefined) return -1;
            // If only 'b' has serial, it comes first
            if (b.serial !== undefined) return 1;
            // Default alphabetic
            return a.name.localeCompare(b.name);
        });
  }, [accountMap, activeTab, searchQuery, getTranslated, accountOrder, hiddenSet]);


  // 3. Prepare Detailed Data for Selected Account
  const partnerData: PartnerSummary | undefined = useMemo(() => {
     if (activeTab !== 'partner' || !selectedAccountName) return undefined;

     const txsIn = transactions.filter(t => t.accountName === selectedAccountName && t.type === 'income');
     const txsOut = transactions.filter(t => t.accountName === selectedAccountName && t.type === 'expense');

     const bookTotalIn = txsIn.reduce((sum, t) => sum + t.amount, 0);
     const bookTotalOut = txsOut.reduce((sum, t) => sum + t.amount, 0);

     const acc = accounts.find(a => a.name === selectedAccountName && a.type === 'partner');
     const allPrev = acc?.ownerPreviousEntries || [];
     const previousReceived = allPrev.filter(e => e.kind === 'received');
     const previousPaid = allPrev.filter(e => e.kind === 'paid');
     const prevIn = previousReceived.reduce((s, e) => s + e.amount, 0);
     const prevOut = previousPaid.reduce((s, e) => s + e.amount, 0);

     const totalIn = bookTotalIn + prevIn;
     const totalOut = bookTotalOut + prevOut;

     const byDateDesc = (a: OwnerPreviousEntry, b: OwnerPreviousEntry) =>
        b.date.localeCompare(a.date) || b.id - a.id;

     return {
         name: selectedAccountName,
         bookTotalIn,
         bookTotalOut,
         totalIn,
         totalOut,
         netBalance: totalIn - totalOut,
         transactionsIn: txsIn.sort((a, b) => b.timestamp - a.timestamp),
         transactionsOut: txsOut.sort((a, b) => b.timestamp - a.timestamp),
         previousReceived: [...previousReceived].sort(byDateDesc),
         previousPaid: [...previousPaid].sort(byDateDesc)
     };
  }, [selectedAccountName, activeTab, transactions, accounts]);

  const customerData: CustomerSummary | undefined = useMemo(() => {
     if (activeTab !== 'customer' || !selectedAccountName) return undefined;

     // 1. Get Stock Dispatches (Bill Generated) -> DEBIT (Receivable)
     const stockOut = stockMovements.filter(m => m.accountName === selectedAccountName && m.type === 'out');
     
     // 2. Get Income (Payments Received) -> CREDIT (Decreases Receivable)
     // Also include Expense (Refunds?) -> DEBIT (Increases Receivable) - Edge case, but handled logic below
     const payments = transactions.filter(t => t.accountName === selectedAccountName);
     
     // Combine into Ledger
     const ledger: CustomerLedgerItem[] = [];
     let runningBalance = 0; // +ve means Receivable

     // Combine and sort by DATE (Primary) then Creation Time/ID (Secondary)
     const combined = [
         ...stockOut.map(m => ({ 
             date: m.date, 
             id: `stock-${m.id}`, 
             raw: m, 
             type: 'stock' as const,
             creationOrder: m.id // Use ID as proxy for creation order
         })),
         ...payments.map(p => ({ 
             date: p.date, 
             id: `pay-${p.id}`, 
             raw: p, 
             type: 'payment' as const,
             creationOrder: p.timestamp 
         }))
     ].sort((a, b) => {
         // 1. Compare Date Strings (YYYY-MM-DD)
         if (a.date !== b.date) {
             return a.date.localeCompare(b.date);
         }
         // 2. Compare Creation Order (ID/Timestamp)
         // Note: Stock ID might be smaller than Payment Timestamp if mixing auto-increment and timestamps,
         // but consistent day-order preference: Stock (Bill) -> Payment (Recv) is preferred.
         // If stock ID is small int, it comes before large timestamp payment.
         return a.creationOrder - b.creationOrder;
     });

     combined.forEach(item => {
         if (item.type === 'stock') {
             const m = item.raw as StockMovement;
             const amount = m.totalAmount || 0;
             runningBalance += amount;
             ledger.push({
                 id: item.id,
                 date: item.date,
                 type: 'stock',
                 description: `${t.dispatchTypeLabel} - ${m.quantityKg/100} Q`,
                 vehicleNumber: m.vehicleNumber,
                 quantityKg: m.quantityKg,
                 rate: m.ratePerQuintal,
                 billedAmount: amount,
                 receivedAmount: 0,
                 runningBalance
             });
         } else {
             const p = item.raw as Transaction;
             // Income = Payment Received = Credit = Reduces Balance
             // Expense = Refund Given = Debit = Increases Balance
             if (p.type === 'income') {
                 runningBalance -= p.amount;
                 ledger.push({
                     id: item.id,
                     date: item.date,
                     type: 'payment',
                     description: `${t.paidPrefix} (${p.paymentType}) ${p.details || ''}`,
                     billedAmount: 0,
                     receivedAmount: p.amount,
                     runningBalance
                 });
             } else {
                 runningBalance += p.amount;
                 ledger.push({
                     id: item.id,
                     date: item.date,
                     type: 'payment',
                     description: `Refund/Exp: ${p.details || ''}`,
                     billedAmount: p.amount,
                     receivedAmount: 0,
                     runningBalance
                 });
             }
         }
     });

     // Reverse Ledger for Display (Newest First)
     const displayLedger = [...ledger].reverse();

     const totalStockKg = stockOut.reduce((sum, m) => sum + m.quantityKg, 0);
     const totalBilled = ledger.reduce((sum, i) => sum + i.billedAmount, 0);
     const totalReceived = ledger.reduce((sum, i) => sum + i.receivedAmount, 0);

     return {
         name: selectedAccountName,
         totalStockKg,
         totalBilled,
         totalReceived,
         balance: runningBalance,
         ledger: displayLedger
     };
  }, [selectedAccountName, activeTab, stockMovements, transactions, t]);

  const supplierData: SupplierSummary | undefined = useMemo(() => {
      if (activeTab !== 'supplier' || !selectedAccountName) return undefined;

      // Logic:
      // Payments Made (Expense) -> Debit (Increases "Paid To Supplier")
      // Refunds/Advances (Income) -> Credit (Decreases "Paid To Supplier")
      // Net Balance = Total Paid - Total Received. 
      // Positive Balance = We have paid more (Advanced). 
      // Negative Balance = We have received more (Debt).

      const relevantTxs = transactions.filter(t => t.accountName === selectedAccountName);
      
      const ledger: SupplierLedgerItem[] = [];
      let runningBalance = 0; // Net Paid

      // Sort Chronological
      const sortedTxs = [...relevantTxs].sort((a,b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.timestamp - b.timestamp;
      });

      sortedTxs.forEach(tx => {
          if (tx.type === 'expense') {
              // We Paid
              runningBalance += tx.amount;
              ledger.push({
                  id: `tx-${tx.id}`,
                  date: tx.date,
                  description: tx.details || 'Payment Made',
                  debitAmount: tx.amount,
                  creditAmount: 0,
                  runningBalance,
                  originalTransaction: tx
              });
          } else {
              // We Received (Refund/Advance)
              runningBalance -= tx.amount;
              ledger.push({
                  id: `tx-${tx.id}`,
                  date: tx.date,
                  description: tx.details || 'Refund/Advance Received',
                  debitAmount: 0,
                  creditAmount: tx.amount,
                  runningBalance,
                  originalTransaction: tx
              });
          }
      });

      const displayLedger = [...ledger].reverse();
      const totalPaid = ledger.reduce((sum, i) => sum + i.debitAmount, 0);
      const totalReceived = ledger.reduce((sum, i) => sum + i.creditAmount, 0);

      return {
          name: selectedAccountName,
          totalPaid,
          totalReceived,
          netBalance: runningBalance,
          ledger: displayLedger
      };

  }, [selectedAccountName, activeTab, transactions]);

  // LABOUR LOGIC
  const labourData: LabourSummary | undefined = useMemo(() => {
    if (activeTab !== 'labour' || !selectedAccountName) return undefined;

    // 1. Get Account Details
    const account = accounts.find(a => a.name === selectedAccountName);
    const rate = account?.rate || 0;
    const attendance = account?.attendance || {};
    const hisaabDays = account?.hisaabDays || {};
    const adjustments = account?.manualAdjustments || [];

    // 2. Get Payments (Expenses)
    const payments = transactions.filter(t => t.accountName === selectedAccountName && t.type === 'expense');
    const totalPaidLifetime = payments.reduce((sum, t) => sum + t.amount, 0);

    // 3. Calculate Lifetime Earnings
    // Iterate all attendance entries - only count 'true'
    const presentDates = Object.keys(attendance).filter(d => attendance[d] === true);
    const totalWorkDaysLifetime = presentDates.length;
    const baseEarningsLifetime = totalWorkDaysLifetime * rate;
    const totalAdjustmentsLifetime = adjustments.reduce((sum, a) => sum + a.amount, 0);
    
    const totalPayableLifetime = baseEarningsLifetime + totalAdjustmentsLifetime;
    const lifetimeBalance = totalPayableLifetime - totalPaidLifetime;

    // 4. Calculate Opening Balance (Prior to selected Range)
    const startOfRange = labourStartDate;
    
    // Attendance before start date
    const daysBefore = Object.keys(attendance).filter(d => d < startOfRange && attendance[d] === true).length;
    const wagesBefore = daysBefore * rate;

    // Adjustments before start date
    const adjsBefore = adjustments.filter(a => a.date < startOfRange).reduce((sum, a) => sum + a.amount, 0);

    // Payments before start date
    const paidBefore = payments.filter(t => t.date < startOfRange).reduce((sum, t) => sum + t.amount, 0);

    const openingBalance = (wagesBefore + adjsBefore) - paidBefore;

    // 5. Build Timeline for Selected Month/Range
    const dates = getDatesInRange(labourStartDate, labourEndDate);
    const dateRows: LabourTimelineRow[] = dates.map(date => {
        // Explicitly get the boolean or undefined from the map
        const isPresent = attendance[date]; // true, false, or undefined
        const isHisaabDay = !!hisaabDays[date];
        const dayTxs = payments.filter(t => t.date === date);
        const dayAdjs = adjustments.filter(a => a.date === date);

        return {
            date,
            isPresent,
            isHisaabDay,
            dailyWage: isPresent === true ? rate : 0,
            transactions: dayTxs,
            adjustments: dayAdjs
        };
    });

    // 6. Month Stats (Derived only from the visible range rows)
    const monthAttendanceDays = dateRows.filter(r => r.isPresent === true).length;
    const monthWage = monthAttendanceDays * rate;
    const monthAdjustments = dateRows.reduce((sum, r) => sum + r.adjustments.reduce((s, a) => s + a.amount, 0), 0);
    const monthPayable = monthWage + monthAdjustments;
    const monthPaid = dateRows.reduce((sum, r) => sum + r.transactions.reduce((s, t) => s + t.amount, 0), 0);

    // 7. Inject Opening Balance Row at the Top
    const timeline: LabourTimelineRow[] = [
        {
            date: 'Opening Balance', // Special marker
            isPresent: undefined,
            isHisaabDay: false,
            dailyWage: 0,
            adjustments: [],
            transactions: [],
            isOpeningBalance: true,
            balance: openingBalance
        },
        ...dateRows
    ];

    return {
        name: selectedAccountName,
        rate,
        lifetimeBalance,
        viewMonthName: `${formatMonthYear(new Date(labourStartDate))}`,
        monthAttendanceDays,
        monthPayable,
        monthPaid,
        timeline: timeline // Opening Balance + Normal Calendar Order
    };
  }, [selectedAccountName, activeTab, transactions, accounts, labourStartDate, labourEndDate]);


  // --- Actions ---

  const handleBack = () => {
      setSelectedAccountName(null);
  };

  const handleAccountSelect = (name: string) => {
      setSelectedAccountName(name);
  };

  const handleCreateAccount = () => {
      if (newAccountName) {
          onAddAccount(newAccountName.trim(), activeTab, parseFloat(newAccountRate) || 0);
          setIsAddModalOpen(false);
          setNewAccountName('');
          setNewAccountRate('400');
      }
  };

  // Nav Handlers
  const handlePrevMonth = () => {
      const start = new Date(labourStartDate);
      start.setMonth(start.getMonth() - 1);
      const startStr = formatISODateLocal(new Date(start.getFullYear(), start.getMonth(), 1));
      const endStr = formatISODateLocal(new Date(start.getFullYear(), start.getMonth() + 1, 0));
      setLabourStartDate(startStr);
      setLabourEndDate(endStr);
  };

  const handleNextMonth = () => {
      const start = new Date(labourStartDate);
      start.setMonth(start.getMonth() + 1);
      const startStr = formatISODateLocal(new Date(start.getFullYear(), start.getMonth(), 1));
      const endStr = formatISODateLocal(new Date(start.getFullYear(), start.getMonth() + 1, 0));
      setLabourStartDate(startStr);
      setLabourEndDate(endStr);
  };

  // Specific Actions calling props
  const handleSetAttendance = (date: string, isPresent: boolean | null) => {
      if (selectedAccountName && onToggleAttendance) {
          onToggleAttendance(selectedAccountName, date, isPresent);
      }
  };

  const handleToggleHisaab = (date: string) => {
      if (selectedAccountName && onToggleHisaab) {
          const current = accounts.find(a => a.name === selectedAccountName)?.hisaabDays?.[date] || false;
          onToggleHisaab(selectedAccountName, date, !current);
      }
  };

  const handleAddAdjustmentLocal = (adj: { date: string, amount: number, note: string }) => {
      if (selectedAccountName && onAddAdjustment) {
          onAddAdjustment(selectedAccountName, adj);
      }
  };

  const handlePayLabour = () => {
      if (selectedAccountName) {
          onOpenTransactionModal('expense', { category: 'labour', accountName: selectedAccountName });
      }
  };

  const handleReceiveRefund = () => {
      if (selectedAccountName) {
          onOpenTransactionModal('income', { category: 'supplier', accountName: selectedAccountName });
      }
  };

  const handleRenameLocal = (oldName: string, newName: string) => {
      if (!onRenameAccount) return;
      const next = newName.trim();
      if (!next || next === oldName) return;
      onRenameAccount(oldName, next);
      // Update selected name locally so UI doesn't break
      setSelectedAccountName(next);
  };

  const handleDeleteAccountClick = (name: string) => {
      if (!onDeleteAccount) return;
      if (!window.confirm(t.confirmDeleteAccount)) return;
      if (!window.confirm(t.confirmDeleteAccountSecond)) return;
      onDeleteAccount(name);
      setSelectedAccountName(null);
  };

  const handleAddOwnerPreviousLocal = (entry: Omit<OwnerPreviousEntry, 'id'>) => {
      if (selectedAccountName && onAddOwnerPreviousEntry) {
          onAddOwnerPreviousEntry(selectedAccountName, entry);
      }
  };

  const handleUpdateOwnerPreviousLocal = (entry: OwnerPreviousEntry) => {
      if (selectedAccountName && onUpdateOwnerPreviousEntry) {
          onUpdateOwnerPreviousEntry(selectedAccountName, entry);
      }
  };

  const handleDeleteOwnerPreviousLocal = (id: number) => {
      if (selectedAccountName && onDeleteOwnerPreviousEntry) {
          onDeleteOwnerPreviousEntry(selectedAccountName, id);
      }
  };

  // PDF
  const handleDownloadPdf = async () => {
      if (!selectedAccountName) return;

      if (activeTab === 'labour' && labourData) {
          await PDFGenerator.generateLabourLedger(labourData, pdfLanguage);
      } else if (activeTab === 'partner' && partnerData) {
          // Generate partner ledger for report date range or default full
          const range = { start: reportStartDate, end: reportEndDate };
          await PDFGenerator.generatePartnerLedger(partnerData, range, 0, pdfLanguage);
      } else if (activeTab === 'customer' && customerData) {
          const range = { start: reportStartDate, end: reportEndDate };
          await PDFGenerator.generateCustomerLedger(customerData, range, 0, pdfLanguage);
      } else if (activeTab === 'supplier' && supplierData) {
          const range = { start: reportStartDate, end: reportEndDate };
          await PDFGenerator.generateSupplierLedger(supplierData, range, 0, pdfLanguage);
      }
  };

  return (
    <AccountPageView 
      t={t}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      
      accountList={accountList}
      onAccountSelect={handleAccountSelect}
      
      selectedAccountName={selectedAccountName}
      onBack={handleBack}
      
      partnerData={partnerData}
      labourData={labourData}
      customerData={customerData}
      supplierData={supplierData}

      onOpenAddAccount={() => setIsAddModalOpen(true)}
      isAddModalOpen={isAddModalOpen}
      newAccountName={newAccountName}
      onNewAccountNameChange={setNewAccountName}
      onConfirmAddAccount={handleCreateAccount}
      onCancelAddAccount={() => setIsAddModalOpen(false)}
      
      newAccountRate={newAccountRate}
      onNewAccountRateChange={setNewAccountRate}
      
      onToggleAttendance={handleSetAttendance}
      onToggleHisaab={handleToggleHisaab}
      onAddAdjustment={handleAddAdjustmentLocal}
      onUpdateAdjustment={onUpdateAdjustment}
      onDeleteAdjustment={onDeleteAdjustment}

      labourStartDate={labourStartDate}
      setLabourStartDate={setLabourStartDate}
      labourEndDate={labourEndDate}
      setLabourEndDate={setLabourEndDate}
      
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
      
      onPayLabour={handlePayLabour}
      onReceiveRefund={handleReceiveRefund}

      onDownloadPdf={handleDownloadPdf}
      pdfLanguage={pdfLanguage}
      setPdfLanguage={setPdfLanguage}

      reportStartDate={reportStartDate}
      setReportStartDate={setReportStartDate}
      reportEndDate={reportEndDate}
      setReportEndDate={setReportEndDate}
      
      getTranslated={getTranslated}
      onUpdateSerial={handleUpdateSerial}
      onRenameAccount={handleRenameLocal}
      onDeleteAccount={handleDeleteAccountClick}
      removedAccounts={removedAccounts.map(a => ({ name: a.name, type: a.type, rate: a.rate }))}
      onRestoreAccount={(name) => {
        const acc = removedAccounts.find(a => a.name === name);
        if (acc && onRestoreAccount) onRestoreAccount(acc);
      }}
      onDeleteRemovedAccount={(name) => {
        if (!onDeleteRemovedAccount) return;
        if (!window.confirm(t.confirmDelete)) return;
        onDeleteRemovedAccount(name);
      }}

      onAddOwnerPreviousEntry={handleAddOwnerPreviousLocal}
      onUpdateOwnerPreviousEntry={handleUpdateOwnerPreviousLocal}
      onDeleteOwnerPreviousEntry={handleDeleteOwnerPreviousLocal}
    />
  );
};
