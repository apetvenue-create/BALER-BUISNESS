
import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Transaction, Translation, AccountTab, PartnerSummary, LabourSummary, StoredAccount, AccountType, LabourLedgerItem, StockMovement, CustomerSummary, CustomerLedgerItem, SupplierSummary, SupplierLedgerItem, TransactionType, Language, ManualAdjustment, OwnerPreviousEntry, AccountOnlyLedgerEntry, FarmerProfileDetails } from '../../types';
import { AccountPageView } from './AccountPage.view';
import { formatMonthYear, formatISODateLocal } from '../../utils';
import { PDFGenerator } from '../../services/pdfGenerator';
import { SettingsService } from '../../services/settings.service';

interface AccountPageControllerProps {
  transactions: Transaction[];
  stockMovements?: StockMovement[]; 
  t: Translation;
  accounts: StoredAccount[];
  /** Hidden from Ledgers list only; does not delete underlying data. */
  hiddenLedgerAccountNames?: string[];
  onAddAccount: (name: string, type: AccountType, rate?: number, details?: FarmerProfileDetails) => void;
  onUpdateAccount: (account: StoredAccount, previousName?: string) => void;
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
  const [isCreatingFarmer, setIsCreatingFarmer] = useState(false);
  const selectedAccountNameRef = useRef<string | null>(null);
  const pushedDetailHistoryRef = useRef(false);

  useEffect(() => {
    selectedAccountNameRef.current = selectedAccountName;
  }, [selectedAccountName]);

  // Esc (laptop): go back from detail view to list
  useEffect(() => {
    if (!selectedAccountName && !isCreatingFarmer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedAccountName(null);
        setIsCreatingFarmer(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAccountName, isCreatingFarmer]);

  // Mobile back button (browser back): go back from detail view to list
  useEffect(() => {
    const onPopState = () => {
      if (selectedAccountNameRef.current || isCreatingFarmer) {
        setSelectedAccountName(null);
        setIsCreatingFarmer(false);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isCreatingFarmer]);

  // When entering a detail screen, push a history entry so "Back" returns to list instead of exiting the app.
  useEffect(() => {
    if (selectedAccountName && !pushedDetailHistoryRef.current) {
      try {
        window.history.pushState({ ledgerDetail: true }, '');
        pushedDetailHistoryRef.current = true;
      } catch {
        // ignore history failures
      }
    }
    if (!selectedAccountName) {
      pushedDetailHistoryRef.current = false;
    }
  }, [selectedAccountName]);

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
  const [newFarmerPhone, setNewFarmerPhone] = useState('');
  const [newFarmerAddress, setNewFarmerAddress] = useState('');
  const [newFarmerAcres, setNewFarmerAcres] = useState('');
  const [newFarmerDateCutter, setNewFarmerDateCutter] = useState('');
  const [newLabourPhone, setNewLabourPhone] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const isLegacyWageAdjustment = (note?: string) => note?.trim().toLowerCase() === 'wage';
  const [accountOrder, setAccountOrder] = useState<Record<string, number>>({});

  // Load Order on Mount
  useEffect(() => {
      SettingsService.get('accountOrderMap').then(data => {
          if (data) setAccountOrder(data);
      });
  }, []);

  // Account-only ledger entries (do not affect global Cashbook)
  const [accountOnlyLedger, setAccountOnlyLedger] = useState<{
    supplier: Record<string, AccountOnlyLedgerEntry[]>;
  }>({ supplier: {} });

  useEffect(() => {
    SettingsService.get('accountOnlyLedger_v1').then((data) => {
      if (data && typeof data === 'object') {
        setAccountOnlyLedger({
          supplier: data.supplier || {}
        });
      }
    });
  }, []);

  const saveAccountOnlyLedger = async (next: typeof accountOnlyLedger) => {
    setAccountOnlyLedger(next);
    await SettingsService.set('accountOnlyLedger_v1', next);
  };

  // NOTE: handleUpdateSerial is defined later (needs derived lists)

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
             const wage = acc.rate || 0;
             const adjTotal = acc.manualAdjustments
               ? acc.manualAdjustments
                   .filter(a => a.note?.trim().toLowerCase() !== 'wage')
                   .reduce((sum, a) => sum + a.amount, 0)
               : 0;
             initialBalance = wage + adjTotal;
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

     // 4. Apply account-only ledger entries for Supplier/Dealer
     // These should affect the same "NET PAYMENT" balance shown in detail view.
     Object.entries(accountOnlyLedger.supplier || {}).forEach(([accountName, entries]) => {
       if (!entries || entries.length === 0) return;
       if (!map.has(accountName)) map.set(accountName, { type: 'supplier', balance: 0 });
       const current = map.get(accountName)!;
       // If account exists but had a different inferred type, keep existing type
       // and only apply if it is supplier.
       if (current.type !== 'supplier') return;
       entries.forEach(e => {
         if (e.kind === 'paid') current.balance += e.amount;
         else if (e.kind === 'received') current.balance -= e.amount;
       });
     });



     return map;
  }, [transactions, accounts, stockMovements, accountOnlyLedger]);


  // 2. Prepare List Data for the active tab (SORTED by Custom Serial)
  const hiddenSet = useMemo(
    () => new Set(hiddenLedgerAccountNames.map(n => n.trim().toLowerCase())),
    [hiddenLedgerAccountNames]
  );

  const handleUpdateSerial = useCallback(async (name: string, serial: number) => {
    const desiredIndex = Math.max(0, (Number.isFinite(serial) ? Math.floor(serial) : 1) - 1);

    // Build the list of accounts for the CURRENT tab (not hidden)
    const namesInTab = Array.from(accountMap.entries())
      .filter(([n, data]) => data.type === activeTab && !hiddenSet.has(n.trim().toLowerCase()))
      .map(([n]) => n);

    if (namesInTab.length === 0) return;

    // Current order: serial first, then name as a stable fallback
    const ordered = [...namesInTab].sort((a, b) => {
      const sa = accountOrder[a];
      const sb = accountOrder[b];
      if (sa !== undefined && sb !== undefined) return sa - sb;
      if (sa !== undefined) return -1;
      if (sb !== undefined) return 1;
      return a.localeCompare(b);
    });

    const without = ordered.filter(n => n !== name);
    const clampedIndex = Math.min(desiredIndex, without.length);
    without.splice(clampedIndex, 0, name);

    // Renumber sequentially so every slot has exactly one account
    const nextOrder = { ...accountOrder };
    without.forEach((n, idx) => {
      nextOrder[n] = idx + 1;
    });

    setAccountOrder(nextOrder);
    await SettingsService.set('accountOrderMap', nextOrder);
  }, [accountMap, activeTab, hiddenSet, accountOrder]);

  const accountList = useMemo(() => {
     return Array.from(accountMap.entries())
        .filter(([name, data]) => {
           const matchesType = data.type === activeTab;
           const matchesSearch = getTranslated(name).toLowerCase().includes(searchQuery.toLowerCase()) || name.toLowerCase().includes(searchQuery.toLowerCase());
           const notHidden = !hiddenSet.has(name.trim().toLowerCase());
           return matchesType && matchesSearch && notHidden;
        })
        .map(([name, data]) => {
            const stored = accounts.find(a => a.name === name);
            return {
              name,
              balance: data.balance,
              serial: accountOrder[name],
              phone: stored?.phone,
              address: stored?.address,
              acres: stored?.acres,
              dateCutter: stored?.dateCutter,
            };
        })
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
  }, [accountMap, activeTab, searchQuery, getTranslated, accountOrder, hiddenSet, accounts]);


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
         phone: accounts.find(a => a.name === selectedAccountName)?.phone,
         totalStockKg,
         totalBilled,
         totalReceived,
         balance: runningBalance,
         ledger: displayLedger
     };
  }, [selectedAccountName, activeTab, stockMovements, transactions, accounts, t]);

  const supplierData: SupplierSummary | undefined = useMemo(() => {
      if (activeTab !== 'supplier' || !selectedAccountName) return undefined;

      // Logic:
      // Payments Made (Expense) -> Debit (Increases "Paid To Supplier")
      // Refunds/Advances (Income) -> Credit (Decreases "Paid To Supplier")
      // Net Balance = Total Paid - Total Received. 
      // Positive Balance = We have paid more (Advanced). 
      // Negative Balance = We have received more (Debt).

      const relevantTxs = transactions.filter(t => t.accountName === selectedAccountName);
      const localEntries = accountOnlyLedger.supplier[selectedAccountName] || [];
      
      const ledger: SupplierLedgerItem[] = [];
      let runningBalance = 0; // Net Paid

      // Sort Chronological
      const combined = [
        ...relevantTxs.map(tx => ({ kind: 'tx' as const, date: tx.date, order: tx.timestamp, tx })),
        ...localEntries.map(e => ({ kind: 'local' as const, date: e.date, order: e.id, entry: e }))
      ].sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.order - b.order));

      combined.forEach(item => {
        if (item.kind === 'tx') {
          const tx = item.tx;
          if (tx.type === 'expense') {
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
            runningBalance -= tx.amount;
            ledger.push({
              id: `tx-${tx.id}`,
              date: tx.date,
              description: tx.details || 'Payment Received',
              debitAmount: 0,
              creditAmount: tx.amount,
              runningBalance,
              originalTransaction: tx
            });
          }
        } else {
          const e = item.entry;
          const isPaid = e.kind === 'paid';
          if (isPaid) runningBalance += e.amount;
          else runningBalance -= e.amount;
          ledger.push({
            id: `local-${e.id}`,
            date: e.date,
            description: e.note || (isPaid ? 'Payment Made' : 'Payment Received'),
            debitAmount: isPaid ? e.amount : 0,
            creditAmount: isPaid ? 0 : e.amount,
            runningBalance
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

  }, [selectedAccountName, activeTab, transactions, accountOnlyLedger.supplier]);



  // LABOUR LOGIC
  const labourData: LabourSummary | undefined = useMemo(() => {
    if (activeTab !== 'labour' || !selectedAccountName) return undefined;

    const account = accounts.find(a => a.name === selectedAccountName);
    const rate = account?.rate || 0;
    const phone = account?.phone;
    const adjustments = (account?.manualAdjustments || []).filter(a => !isLegacyWageAdjustment(a.note));
    const payments = transactions.filter(t => t.accountName === selectedAccountName && t.type === 'expense');

    const totalPaidLifetime = payments.reduce((sum, t) => sum + t.amount, 0);
    const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
    const totalPayableLifetime = rate + totalAdjustments;
    const lifetimeBalance = totalPayableLifetime - totalPaidLifetime;

    const startOfRange = labourStartDate;
    const endOfRange = labourEndDate;

    const adjsBefore = adjustments.filter(a => a.date < startOfRange).reduce((sum, a) => sum + a.amount, 0);
    const paidBefore = payments.filter(t => t.date < startOfRange).reduce((sum, t) => sum + t.amount, 0);
    const openingBalance = rate + adjsBefore - paidBefore;

    const rangeAdjustments = adjustments.filter(a => a.date >= startOfRange && a.date <= endOfRange);

    const events = rangeAdjustments
      .map(adj => ({ date: adj.date, order: adj.id, adj }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

    const ledger: LabourLedgerItem[] = [
      {
        id: 'opening',
        date: startOfRange,
        type: 'opening',
        description: 'Opening Balance',
        creditAmount: 0,
        debitAmount: 0,
        runningBalance: openingBalance,
        isOpeningBalance: true,
      },
    ];

    let running = openingBalance;
    events.forEach(ev => {
        const adj = ev.adj;
        running += adj.amount;
        ledger.push({
          id: `adj-${adj.id}`,
          date: adj.date,
          type: 'adjustment',
          description: getTranslated(adj.note) || 'Adjustment',
          creditAmount: adj.amount > 0 ? adj.amount : 0,
          debitAmount: adj.amount < 0 ? Math.abs(adj.amount) : 0,
          runningBalance: running,
          adjustmentId: adj.id,
          adjustment: adj,
        });
    });

    return {
      name: selectedAccountName,
      rate,
      phone,
      lifetimeBalance,
      lifetimePaid: totalPaidLifetime,
      lifetimePayable: totalPayableLifetime,
      rangePaid: 0,
      viewMonthName: `${formatMonthYear(new Date(labourStartDate))}`,
      ledger,
    };
  }, [selectedAccountName, activeTab, transactions, accounts, labourStartDate, labourEndDate, getTranslated]);


  // --- Actions ---

  const handleBack = () => {
      setSelectedAccountName(null);
      setIsCreatingFarmer(false);
  };

  const handleAccountSelect = (name: string) => {
      setIsCreatingFarmer(false);
      setSelectedAccountName(name);
  };

  const handleCreateAccount = () => {
      if (newAccountName) {
          const farmerDetails =
            activeTab === 'supplier'
              ? {
                  phone: newFarmerPhone.trim() || undefined,
                  address: newFarmerAddress.trim() || undefined,
                  acres: newFarmerAcres ? parseFloat(newFarmerAcres) : undefined,
                  dateCutter: newFarmerDateCutter || undefined,
                }
              : activeTab === 'labour'
              ? {
                  phone: newLabourPhone.replace(/\D/g, '').slice(0, 10) || undefined,
                }
              : activeTab === 'customer'
              ? {
                  phone: newCustomerPhone.replace(/\D/g, '').slice(0, 10) || undefined,
                }
              : undefined;
          onAddAccount(newAccountName.trim(), activeTab, parseFloat(newAccountRate) || 0, farmerDetails);
          setIsAddModalOpen(false);
          setNewAccountName('');
          setNewAccountRate('400');
          setNewFarmerPhone('');
          setNewFarmerAddress('');
          setNewFarmerAcres('');
          setNewFarmerDateCutter('');
          setNewLabourPhone('');
          setNewCustomerPhone('');
      }
  };

  const handleOpenAddAccount = () => {
    if (activeTab === 'supplier') {
      setSelectedAccountName(null);
      setIsCreatingFarmer(true);
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleCreateFarmerFromDetails = (name: string, details: FarmerProfileDetails) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddAccount(trimmed, 'supplier', 0, details);
    setIsCreatingFarmer(false);
    setSelectedAccountName(null);
  };

  const selectedFarmerAccount = useMemo(() => {
    if (activeTab !== 'supplier' || !selectedAccountName) return undefined;
    return accounts.find(a => a.name === selectedAccountName);
  }, [activeTab, selectedAccountName, accounts]);

  const handleSaveFarmerDetails = (details: FarmerProfileDetails) => {
    if (!selectedFarmerAccount) return;
    onUpdateAccount({
      ...selectedFarmerAccount,
      phone: details.phone,
      address: details.address,
      acres: details.acres,
      dateCutter: details.dateCutter,
    });
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

  const handleUpdateLabourWage = (wage: number) => {
      if (!selectedAccountName) return;
      const account = accounts.find(a => a.name === selectedAccountName);
      if (!account) return;
      onUpdateAccount({ ...account, rate: wage });
  };

  const handleUpdateLabourProfile = (oldName: string, newName: string, phone: string) => {
      const trimmedName = newName.trim();
      if (!trimmedName) return;
      const digits = phone.replace(/\D/g, '').slice(0, 10);
      if (digits.length !== 10) return;

      const account = accounts.find(a => a.name === oldName);
      if (!account) return;

      // Save phone on current account name first (reliable match), then rename if needed
      onUpdateAccount({
          ...account,
          phone: digits,
      });
      if (trimmedName !== oldName.trim()) {
          handleRenameLocal(oldName, trimmedName);
      }
  };

  const handleUpdateCustomerProfile = (oldName: string, newName: string, phone: string) => {
      const trimmedName = newName.trim();
      const digits = phone.replace(/\D/g, '').slice(0, 10);
      if (!trimmedName || digits.length !== 10) return;
      const account = accounts.find(a => a.name === oldName);
      if (!account) return;

      onUpdateAccount({ ...account, phone: digits });
      if (trimmedName !== oldName.trim()) handleRenameLocal(oldName, trimmedName);
  };

  const handlePayLabour = () => {
      if (selectedAccountName) {
          onOpenTransactionModal('expense', { category: 'labour', accountName: selectedAccountName });
      }
  };

  const handleReceiveRefund = () => {
      // Intentionally NOT opening Cashbook income.
      // Supplier "RECEIVED" adds an account-only ledger entry.
      if (!selectedAccountName) return;
      // UI is handled in the view via modal; this handler stays for backward compatibility if wired.
  };



  const handleAddAccountOnlyEntry = async (
    kind: 'supplier',
    accountName: string,
    entry: Omit<AccountOnlyLedgerEntry, 'id'>
  ) => {
    const id = Date.now();
    const list = accountOnlyLedger.supplier[accountName] || [];
    const nextEntry: AccountOnlyLedgerEntry = { id, ...entry };
    const next = {
      supplier: {
        ...accountOnlyLedger.supplier,
        [accountName]: [...list, nextEntry]
      }
    };
    await saveAccountOnlyLedger(next);
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
      onTabChange={(tab) => {
        setIsCreatingFarmer(false);
        setSelectedAccountName(null);
        setActiveTab(tab);
      }}
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
      selectedFarmerAccount={selectedFarmerAccount}
      isCreatingFarmer={isCreatingFarmer}
      onSaveFarmerDetails={handleSaveFarmerDetails}
      onCreateFarmer={handleCreateFarmerFromDetails}

      onOpenAddAccount={handleOpenAddAccount}
      isAddModalOpen={isAddModalOpen}
      newAccountName={newAccountName}
      onNewAccountNameChange={setNewAccountName}
      onConfirmAddAccount={handleCreateAccount}
      onCancelAddAccount={() => {
        setIsAddModalOpen(false);
        setNewFarmerPhone('');
        setNewFarmerAddress('');
        setNewFarmerAcres('');
        setNewFarmerDateCutter('');
        setNewLabourPhone('');
        setNewCustomerPhone('');
      }}
      
      newAccountRate={newAccountRate}
      onNewAccountRateChange={setNewAccountRate}
      newFarmerPhone={newFarmerPhone}
      onNewFarmerPhoneChange={setNewFarmerPhone}
      newFarmerAddress={newFarmerAddress}
      onNewFarmerAddressChange={setNewFarmerAddress}
      newFarmerAcres={newFarmerAcres}
      onNewFarmerAcresChange={setNewFarmerAcres}
      newFarmerDateCutter={newFarmerDateCutter}
      onNewFarmerDateCutterChange={setNewFarmerDateCutter}
      newLabourPhone={newLabourPhone}
      onNewLabourPhoneChange={setNewLabourPhone}
      newCustomerPhone={newCustomerPhone}
      onNewCustomerPhoneChange={setNewCustomerPhone}
      
      onUpdateLabourWage={handleUpdateLabourWage}
      onUpdateLabourProfile={handleUpdateLabourProfile}
      onUpdateCustomerProfile={handleUpdateCustomerProfile}
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

      onAddAccountOnlyEntry={handleAddAccountOnlyEntry}

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
