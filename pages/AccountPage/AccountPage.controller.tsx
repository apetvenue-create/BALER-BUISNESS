
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Translation, AccountTab, PartnerSummary, LabourSummary, StoredAccount, AccountType, LabourTimelineRow, StockMovement, CustomerSummary, CustomerLedgerItem, SupplierSummary, SupplierLedgerItem, TransactionType, Language, ManualAdjustment } from '../../types';
import { AccountPageView } from './AccountPage.view';
import { formatMonthYear, getDatesInRange } from '../../utils';
import { PDFGenerator } from '../../services/pdfGenerator';

interface AccountPageControllerProps {
  transactions: Transaction[];
  stockMovements?: StockMovement[]; // Optional to keep existing usage valid if not passed everywhere yet
  t: Translation;
  accounts: StoredAccount[];
  onAddAccount: (name: string, type: AccountType, rate?: number) => void;
  onUpdateAccount: (account: StoredAccount) => void;
  onOpenTransactionModal: (mode: TransactionType, defaults?: { category?: string, accountName?: string }) => void;
  initialTab?: AccountTab;
  getTranslated: (text?: string) => string;
}

export const AccountPageController: React.FC<AccountPageControllerProps> = ({ 
  transactions, 
  stockMovements = [], // Default to empty if not passed
  t, 
  accounts,
  onAddAccount,
  onUpdateAccount,
  onOpenTransactionModal,
  initialTab = 'labour',
  getTranslated
}) => {
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);

  // LABOUR: Date Range State (Default: Current Month)
  const [labourStartDate, setLabourStartDate] = useState<string>(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [labourEndDate, setLabourEndDate] = useState<string>(
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  // PDF / Report Date Ranges
  const [reportStartDate, setReportStartDate] = useState<string>(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [reportEndDate, setReportEndDate] = useState<string>(
      new Date().toISOString().split('T')[0]
  );
  
  // PDF Language State
  const [pdfLanguage, setPdfLanguage] = useState<Language>('en');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountRate, setNewAccountRate] = useState<string>('400'); // Default rate

  // Effect to sync initialTab if changed from parent
  useEffect(() => {
      setActiveTab(initialTab);
      setSelectedAccountName(null);
  }, [initialTab]);

  // --- Logic: Derive Account Balances & Merge with Registered List ---
  
  const accountMap = useMemo(() => {
     const map = new Map<string, { type: AccountTab; balance: number }>();

     // 1. Initialize with all registered accounts that match our Tabs
     accounts.forEach(acc => {
         const type = acc.type.toLowerCase();
         // Map stored types to tabs
         if (type === 'labour') map.set(acc.name, { type: 'labour', balance: 0 });
         else if (type === 'partner') map.set(acc.name, { type: 'partner', balance: 0 });
         else if (type === 'customer') map.set(acc.name, { type: 'customer', balance: 0 });
         else if (type === 'supplier') map.set(acc.name, { type: 'supplier', balance: 0 });
     });

     // 2. Compute balances from transactions (General view)
     transactions.forEach(tr => {
        if (!tr.accountName) return;

        // Self-Healing
        if (!map.has(tr.accountName)) {
            // Infer type
            if (tr.category === 'labour') map.set(tr.accountName, { type: 'labour', balance: 0 });
            else if (tr.category === 'partner') map.set(tr.accountName, { type: 'partner', balance: 0 });
            else if (tr.category === 'customer') map.set(tr.accountName, { type: 'customer', balance: 0 });
            else if (tr.category === 'shop' || tr.category === 'oil') {
                // Ignore general shop/oil expense if it just happens to have a name, unless already in map
            }
        }

        if (map.has(tr.accountName)) {
            const current = map.get(tr.accountName)!;
            // Balance Calc:
            // For Customer/Partner: Income is +, Expense is -.
            // For Supplier: Expense (Money Out) is Debit. Income (Refund) is Credit.
            // General List View just shows net flow for simplicity, detail view handles specifics.
            if (tr.type === 'income') current.balance += tr.amount;
            else current.balance -= tr.amount;
        }
     });

     return map;
  }, [transactions, accounts]);


  // 2. Prepare List Data for the active tab
  const accountList = useMemo(() => {
     return Array.from(accountMap.entries())
        .filter(([name, data]) => {
           const matchesType = data.type === activeTab;
           const matchesSearch = getTranslated(name).toLowerCase().includes(searchQuery.toLowerCase()) || name.toLowerCase().includes(searchQuery.toLowerCase());
           return matchesType && matchesSearch;
        })
        .map(([name, data]) => ({ name, balance: data.balance }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [accountMap, activeTab, searchQuery, getTranslated]);


  // 3. Prepare Detailed Data for Selected Account
  const partnerData: PartnerSummary | undefined = useMemo(() => {
     if (!selectedAccountName || activeTab !== 'partner') return undefined;

     const related = transactions.filter(tr => tr.accountName === selectedAccountName);
     
     // Separate In/Out
     const transactionsIn = related.filter(tr => tr.type === 'income');
     const transactionsOut = related.filter(tr => tr.type === 'expense');

     const totalIn = transactionsIn.reduce((sum, t) => sum + t.amount, 0);
     const totalOut = transactionsOut.reduce((sum, t) => sum + t.amount, 0);

     return {
        name: selectedAccountName,
        totalIn,
        totalOut,
        netBalance: totalIn - totalOut,
        transactionsIn,
        transactionsOut
     };
  }, [selectedAccountName, activeTab, transactions]);

  // SUPPLIER DATA LOGIC (STRICT ISOLATION)
  const supplierData: SupplierSummary | undefined = useMemo(() => {
    if (!selectedAccountName || activeTab !== 'supplier') return undefined;

    // Strict Rule 1: Money Paid to Supplier (Expense) = DEBIT
    // Must be category 'supplier' to enforce isolation from general expenses
    const debits = transactions.filter(t => 
        t.accountName === selectedAccountName && 
        t.type === 'expense' && 
        t.category === 'supplier'
    );
    
    // Strict Rule 2: Money Received from Supplier (Income) = CREDIT
    // Must be category 'supplier'
    const credits = transactions.filter(t => 
        t.accountName === selectedAccountName && 
        t.type === 'income' && 
        t.category === 'supplier'
    );

    // Create Ledger Items
    const ledger: SupplierLedgerItem[] = [];

    debits.forEach(t => {
        ledger.push({
            id: `dr-${t.id}`,
            date: t.date,
            description: t.details || 'Payment Made',
            debitAmount: t.amount,
            creditAmount: 0,
            runningBalance: 0, // calc later
            originalTransaction: t
        });
    });

    credits.forEach(t => {
        ledger.push({
            id: `cr-${t.id}`,
            date: t.date,
            description: t.details || 'Refund/Advance Received',
            debitAmount: 0,
            creditAmount: t.amount,
            runningBalance: 0, // calc later
            originalTransaction: t
        });
    });

    // Sort Chronologically
    ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id));

    // Calculate Running Balance
    // Balance Rule: Debit (Paid) - Credit (Received)
    let running = 0;
    const computedLedger = ledger.map(item => {
        running = running + item.debitAmount - item.creditAmount;
        return { ...item, runningBalance: running };
    });

    // Reverse for Display (Newest First)
    const displayLedger = [...computedLedger].reverse();

    const totalPaid = debits.reduce((sum, t) => sum + t.amount, 0);
    const totalReceived = credits.reduce((sum, t) => sum + t.amount, 0);

    return {
        name: selectedAccountName,
        totalPaid,
        totalReceived,
        netBalance: running, // Final balance
        ledger: displayLedger
    };

  }, [selectedAccountName, activeTab, transactions]);

  const customerData: CustomerSummary | undefined = useMemo(() => {
     if (!selectedAccountName || activeTab !== 'customer') return undefined;

     const stockOut = stockMovements.filter(m => m.accountName === selectedAccountName && m.type === 'out');
     const payments = transactions.filter(t => t.accountName === selectedAccountName && t.type === 'income');
     const expenses = transactions.filter(t => t.accountName === selectedAccountName && t.type === 'expense');

     const totalStockKg = stockOut.reduce((sum, m) => sum + m.quantityKg, 0);
     
     // Total Billed/Debit
     const totalBilled = stockOut.reduce((sum, m) => sum + (m.totalAmount || 0), 0) 
                       + expenses.reduce((sum, t) => sum + t.amount, 0);
                       
     // Total Received/Credit
     const totalReceived = payments.reduce((sum, t) => sum + t.amount, 0);

     // Merge lists for Ledger
     const rawLedger: CustomerLedgerItem[] = [];
     
     // A. Stock Dispatches -> DEBIT (Bill)
     stockOut.forEach(m => {
         rawLedger.push({
             id: `stock-${m.id}`,
             date: m.date,
             type: 'stock',
             description: `Bill/Dispatch: ${(m.quantityKg/100).toFixed(2)} Q`,
             vehicleNumber: m.vehicleNumber,
             quantityKg: m.quantityKg,
             rate: m.ratePerQuintal,
             billedAmount: m.totalAmount || 0, // DEBIT
             receivedAmount: 0,
             runningBalance: 0
         });
     });

     // B. Payments Received -> CREDIT
     payments.forEach(t => {
         rawLedger.push({
             id: `trans-${t.id}`,
             date: t.date,
             type: 'payment',
             description: t.details || 'Payment Received',
             billedAmount: 0,
             receivedAmount: t.amount, // CREDIT
             runningBalance: 0
         });
     });

     // C. Expenses / Cash Given -> DEBIT
     expenses.forEach(t => {
         rawLedger.push({
             id: `trans-${t.id}`,
             date: t.date,
             type: 'payment',
             description: t.details || 'Cash Advance / Expense',
             billedAmount: t.amount, // DEBIT
             receivedAmount: 0,
             runningBalance: 0
         });
     });

     // Sort Chronologically (Oldest First) to calculate running balance correctly
     rawLedger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id));

     let currentBalance = 0; // Positive = Receivable (Dr)
     const calculatedLedger = rawLedger.map(item => {
         // Debit adds to Receivable. Credit subtracts.
         currentBalance = currentBalance + item.billedAmount - item.receivedAmount;
         return { ...item, runningBalance: currentBalance };
     });

     // For Display: Sort Newest First (Descending)
     const displayLedger = [...calculatedLedger].reverse();

     return {
        name: selectedAccountName,
        totalStockKg,
        totalBilled,
        totalReceived,
        balance: currentBalance, // Final Balance
        ledger: displayLedger
     };
  }, [selectedAccountName, activeTab, stockMovements, transactions]);


  const labourData: LabourSummary | undefined = useMemo(() => {
     if (!selectedAccountName || activeTab !== 'labour') return undefined;
     
     const account = accounts.find(a => a.name === selectedAccountName);
     const rate = account?.rate || 400;
     const attendance = account?.attendance || {};
     const hisaabDays = account?.hisaabDays || {};
     const adjustments = account?.manualAdjustments || [];

     // Lifetime calculations
     const allPayments = transactions.filter(tr => tr.accountName === selectedAccountName && tr.type === 'expense');
     const lifetimePaid = allPayments.reduce((sum, t) => sum + t.amount, 0);
     const allAttendanceDates = Object.keys(attendance);
     
     // Payable = (Days * Rate) + Adjustments
     const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);
     const lifetimePayable = (allAttendanceDates.length * rate) + totalAdjustments;
     const lifetimeBalance = lifetimePayable - lifetimePaid;

     // View Range Logic
     const timeline: LabourTimelineRow[] = [];
     let monthAttendanceDays = 0;
     let monthPaid = 0;
     let monthPayableRaw = 0;
     let monthAdjustments = 0;
     
     // Generate all dates in current selected range
     const dates = getDatesInRange(labourStartDate, labourEndDate);
     
     dates.forEach(dateStr => {
         const isPresent = !!attendance[dateStr];
         if (isPresent) monthAttendanceDays++;
         
         const isHisaabDay = !!hisaabDays[dateStr];
         
         const dayPayments = allPayments.filter(p => p.date === dateStr);
         monthPaid += dayPayments.reduce((s, p) => s + p.amount, 0);
         
         const dayAdjustments = adjustments.filter(a => a.date === dateStr);
         const dayAdjTotal = dayAdjustments.reduce((s, a) => s + a.amount, 0);
         monthAdjustments += dayAdjTotal;

         if (isPresent) monthPayableRaw += rate;

         timeline.push({
             date: dateStr,
             isPresent,
             isHisaabDay,
             dailyWage: isPresent ? rate : 0,
             adjustments: dayAdjustments,
             transactions: dayPayments
         });
     });

     return {
        name: selectedAccountName,
        rate,
        lifetimeBalance,
        viewMonthName: "Custom Range", 
        monthAttendanceDays,
        monthPayable: monthPayableRaw + monthAdjustments,
        monthPaid,
        timeline
     };
  }, [selectedAccountName, activeTab, transactions, accounts, labourStartDate, labourEndDate]);

  
  // --- Handlers ---

  const handleOpenAddModal = () => {
      setNewAccountName('');
      setNewAccountRate('400'); // Reset to default
      setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
      setIsAddModalOpen(false);
      setNewAccountName('');
  };

  const handleConfirmAddAccount = () => {
      if (newAccountName && newAccountName.trim()) {
          const rate = activeTab === 'labour' ? (parseInt(newAccountRate) || 400) : undefined;
          onAddAccount(newAccountName.trim(), activeTab, rate);
          handleCloseAddModal();
      } 
      // Validation handled in View component now
  };

  const handleToggleAttendance = (date: string) => {
      if (!selectedAccountName) return;
      const account = accounts.find(a => a.name === selectedAccountName);
      if (!account) return;
      
      const newAttendance = { ...(account.attendance || {}) };
      if (newAttendance[date]) delete newAttendance[date];
      else newAttendance[date] = true;

      onUpdateAccount({
          ...account,
          attendance: newAttendance
      });
  };

  const handleToggleHisaab = (date: string) => {
      if (!selectedAccountName) return;
      const account = accounts.find(a => a.name === selectedAccountName);
      if (!account) return;
      
      const newHisaab = { ...(account.hisaabDays || {}) };
      if (newHisaab[date]) delete newHisaab[date];
      else newHisaab[date] = true;

      onUpdateAccount({
          ...account,
          hisaabDays: newHisaab
      });
  };

  const handleAddAdjustment = (adj: { date: string, amount: number, note: string }) => {
      if (!selectedAccountName) return;
      const account = accounts.find(a => a.name === selectedAccountName);
      if (!account) return;

      const newAdj: ManualAdjustment = {
          id: Date.now() + Math.random(),
          ...adj
      };

      onUpdateAccount({
          ...account,
          manualAdjustments: [...(account.manualAdjustments || []), newAdj]
      });
  };

  const handleUpdateAdjustment = (updatedAdj: ManualAdjustment) => {
      if (!selectedAccountName) return;
      const account = accounts.find(a => a.name === selectedAccountName);
      if (!account) return;

      const newAdjustments = account.manualAdjustments?.map(a => 
          a.id === updatedAdj.id ? updatedAdj : a
      ) || [];

      onUpdateAccount({
          ...account,
          manualAdjustments: newAdjustments
      });
  };

  const handleDeleteAdjustment = (id: number) => {
      if (!selectedAccountName) return;
      const account = accounts.find(a => a.name === selectedAccountName);
      if (!account) return;

      const newAdjustments = account.manualAdjustments?.filter(a => a.id !== id) || [];

      onUpdateAccount({
          ...account,
          manualAdjustments: newAdjustments
      });
  };

  const handleReceiveRefund = () => {
      if (selectedAccountName) {
          onOpenTransactionModal('income', {
              category: 'supplier',
              accountName: selectedAccountName
          });
      }
  };

  const handlePayLabour = () => {
      if (selectedAccountName) {
          onOpenTransactionModal('expense', {
              category: 'labour',
              accountName: selectedAccountName
          });
      }
  };

  // Labour Date Navigation Helpers
  const handlePrevMonth = () => {
      const current = new Date(labourStartDate);
      current.setMonth(current.getMonth() - 1);
      const start = new Date(current.getFullYear(), current.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(current.getFullYear(), current.getMonth() + 1, 0).toISOString().split('T')[0];
      setLabourStartDate(start);
      setLabourEndDate(end);
  };

  const handleNextMonth = () => {
      const current = new Date(labourStartDate);
      current.setMonth(current.getMonth() + 1);
      const start = new Date(current.getFullYear(), current.getMonth(), 1).toISOString().split('T')[0];
      const end = new Date(current.getFullYear(), current.getMonth() + 1, 0).toISOString().split('T')[0];
      setLabourStartDate(start);
      setLabourEndDate(end);
  };

  const handleDownloadPdf = async () => {
      if (!selectedAccountName) return;

      const dateRange = { start: reportStartDate, end: reportEndDate };

      if (activeTab === 'customer' && customerData) {
          const chronoLedger = [...customerData.ledger].reverse();
          let openingBalance = 0;
          const filteredLedger: CustomerLedgerItem[] = [];

          chronoLedger.forEach(item => {
              if (item.date < reportStartDate) {
                  openingBalance = openingBalance + item.billedAmount - item.receivedAmount;
              } else if (item.date <= reportEndDate) {
                  filteredLedger.push(item);
              }
          });

          const filteredSummary = { ...customerData, ledger: filteredLedger };
          await PDFGenerator.generateCustomerLedger(filteredSummary, dateRange, openingBalance, pdfLanguage);

      } else if (activeTab === 'supplier' && supplierData) {
          const chronoLedger = [...supplierData.ledger].reverse();
          let openingBalance = 0;
          const filteredLedger: SupplierLedgerItem[] = [];

          chronoLedger.forEach(item => {
              if (item.date < reportStartDate) {
                  openingBalance = openingBalance + item.debitAmount - item.creditAmount;
              } else if (item.date <= reportEndDate) {
                  filteredLedger.push(item);
              }
          });

          const filteredSummary = { ...supplierData, ledger: filteredLedger };
          await PDFGenerator.generateSupplierLedger(filteredSummary, dateRange, openingBalance, pdfLanguage);

      } else if (activeTab === 'partner' && partnerData) {
          const allTrans = [
              ...partnerData.transactionsIn.map(t => ({...t, debit: 0, credit: t.amount})),
              ...partnerData.transactionsOut.map(t => ({...t, debit: t.amount, credit: 0}))
          ].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          let openingBalance = 0;
          const filteredIn: Transaction[] = [];
          const filteredOut: Transaction[] = [];

          allTrans.forEach(t => {
              if (t.date < reportStartDate) {
                  openingBalance = openingBalance + t.credit - t.debit;
              } else if (t.date <= reportEndDate) {
                  if (t.credit > 0) filteredIn.push(t);
                  else filteredOut.push(t);
              }
          });

          const filteredSummary = { 
              ...partnerData, 
              transactionsIn: filteredIn, 
              transactionsOut: filteredOut 
          };
          await PDFGenerator.generatePartnerLedger(filteredSummary, dateRange, openingBalance, pdfLanguage);

      } else if (activeTab === 'labour' && labourData) {
          await PDFGenerator.generateLabourLedger(labourData, pdfLanguage);
      }
  };

  return (
    <AccountPageView 
       t={t}
       activeTab={activeTab}
       onTabChange={(tab) => {
           setActiveTab(tab);
           setSelectedAccountName(null);
       }}
       searchQuery={searchQuery}
       onSearchChange={setSearchQuery}
       accountList={accountList}
       onAccountSelect={setSelectedAccountName}
       selectedAccountName={selectedAccountName}
       onBack={() => setSelectedAccountName(null)}
       partnerData={partnerData}
       labourData={labourData}
       customerData={customerData}
       supplierData={supplierData}
       
       onOpenAddAccount={handleOpenAddModal}
       isAddModalOpen={isAddModalOpen}
       newAccountName={newAccountName}
       onNewAccountNameChange={setNewAccountName}
       onConfirmAddAccount={handleConfirmAddAccount}
       onCancelAddAccount={handleCloseAddModal}
       
       newAccountRate={newAccountRate}
       onNewAccountRateChange={setNewAccountRate}

       onToggleAttendance={handleToggleAttendance}
       
       onPrevMonth={handlePrevMonth}
       onNextMonth={handleNextMonth}
       
       // Labour specific props
       labourStartDate={labourStartDate}
       setLabourStartDate={setLabourStartDate}
       labourEndDate={labourEndDate}
       setLabourEndDate={setLabourEndDate}
       onToggleHisaab={handleToggleHisaab}
       onAddAdjustment={handleAddAdjustment}
       onUpdateAdjustment={handleUpdateAdjustment}
       onDeleteAdjustment={handleDeleteAdjustment}
       
       onReceiveRefund={handleReceiveRefund}
       onPayLabour={handlePayLabour}
       onDownloadPdf={handleDownloadPdf}
       
       reportStartDate={reportStartDate}
       setReportStartDate={setReportStartDate}
       reportEndDate={reportEndDate}
       setReportEndDate={setReportEndDate}
       
       pdfLanguage={pdfLanguage}
       setPdfLanguage={setPdfLanguage}

       getTranslated={getTranslated}
    />
  );
};
