

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Transaction, 
  TransactionType, 
  Translation, 
  Language,
  StoredAccount,
  AccountType,
  DateFilter,
  StockMovement,
  ManualAdjustment
} from './types';
import { TRANSLATIONS } from './constants';
import { getDatesInRange, formatIndianCurrency, formatDisplayDate } from './utils';
import { TransactionModal } from './components/TransactionModal';
import { AccountPageController } from './pages/AccountPage/AccountPage.controller';
import { StockPageController } from './pages/StockPage/StockPage.controller';
import { ReportsPageController } from './pages/ReportsPage/ReportsPage.controller';
import { DateInput } from './components/DateInput';
import { translateBatch } from './services/ai';
import { AuthProvider, useAuth } from './auth/auth.store';
import { AuthGuard } from './auth/auth.guard';

// Services
import { TransactionService } from './services/transactions.service';
import { AccountService } from './services/accounts.service';
import { StockService } from './services/stock.service';
import { SettingsService } from './services/settings.service';

// --- AUTH HEADER COMPONENT ---
const UserProfileHeader: React.FC = () => {
  const { session, signOut } = useAuth();
  
  if (!session) return null;

  return (
    <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
        <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500 font-semibold">Logged in as</p>
            <p className="text-sm font-bold text-gray-800">{session.name || session.email}</p>
        </div>
        <button 
            type="button"
            onClick={() => {
                if(window.confirm("Are you sure you want to logout?")) {
                    signOut();
                }
            }}
            className="text-red-600 hover:bg-red-50 p-2 rounded-full transition cursor-pointer"
            title="Logout"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
        </button>
    </div>
  );
};

// --- MAIN FINANCIAL APP (WRAPPED CONTENT) ---
const FinancialApp: React.FC = () => {
  // State
  const [language, setLanguage] = useState<Language>('en');
  const t = TRANSLATIONS[language];
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts' | 'stock' | 'reports'>('transactions');
  
  // Translation State
  const [isTranslating, setIsTranslating] = useState(false);
  // Cache structure: { 'hi': { 'Hello': 'नमस्ते' }, 'pa': { ... } }
  const [translationCache, setTranslationCache] = useState<Record<string, Record<string, string>>>({
      hi: {},
      pa: {}
  });
  
  // Cashbook State
  const [dateFilter, setDateFilter] = useState<DateFilter>({
      mode: 'single',
      singleDate: new Date().toISOString().split('T')[0],
      fromDate: new Date().toISOString().split('T')[0],
      toDate: new Date().toISOString().split('T')[0]
  });

  // Opening Balance State (Manually set start values)
  const [initialOpeningBalance, setInitialOpeningBalance] = useState({ cash: 0, online: 0 });
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [tempOpeningBalance, setTempOpeningBalance] = useState({ cash: '0', online: '0' });

  // Stats Section State
  const [statsStartDate, setStatsStartDate] = useState<string>(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [statsEndDate, setStatsEndDate] = useState<string>(
      new Date().toISOString().split('T')[0]
  );
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalDefaults, setModalDefaults] = useState<{ category?: string, accountName?: string }>({});

  const [isLoading, setIsLoading] = useState(true);

  // --- Initial Data Load (Migration from LocalStorage to Supabase) ---
  const loadData = async () => {
      setIsLoading(true);
      try {
          const [txs, accs, stocks, ob, transCache] = await Promise.all([
              TransactionService.getAll(),
              AccountService.getAll(),
              StockService.getAll(),
              SettingsService.get('openingBalanceData'),
              SettingsService.get('translationCache')
          ]);

          setTransactions(txs);
          setAccounts(accs);
          setStockMovements(stocks);
          if (ob) setInitialOpeningBalance(ob);
          if (transCache) setTranslationCache(transCache);
          
      } catch (e: any) {
          console.error("Failed to load data", e);
          let errorMessage = "Unknown error occurred";
          if (typeof e === 'string') errorMessage = e;
          else if (e instanceof Error) errorMessage = e.message;
          else if (typeof e === 'object' && e !== null) errorMessage = e.message || e.error_description || JSON.stringify(e);
          
          if (typeof errorMessage === 'object') {
              try { errorMessage = JSON.stringify(errorMessage); } catch { errorMessage = "Unparsable error object"; }
          }
          alert(`Error loading data from server: ${errorMessage}. Please refresh.`);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Persistence Handlers (Optimistic) ---

  const handleCreateAccount = async (name: string, type: AccountType, rate?: number) => {
      // Optimistic Check & Update
      if (accounts.some(a => a.name.toLowerCase() === name.toLowerCase())) return;
      
      const safeType: AccountType = ['labour', 'partner', 'customer', 'supplier', 'other'].includes(type) ? type : 'other';
      
      const newAccount: StoredAccount = {
          name,
          type: safeType,
          rate,
          attendance: {},
          hisaabDays: {},
          manualAdjustments: []
      };

      // Update State Immediately
      setAccounts(prev => [...prev, newAccount]);

      // Sync
      try {
          await AccountService.create(name, safeType, rate);
          // Optional: Re-fetch ID or details if needed, but for simple accounts, name is ID often.
      } catch (e) {
          console.error("Create account failed", e);
          // Rollback if needed
          setAccounts(prev => prev.filter(a => a.name !== name));
          alert("Failed to create account on server.");
      }
  };

  const handleUpdateAccount = async (updated: StoredAccount) => {
      // Not typically used directly in UI, usually granular updates
  };

  const handleAddTransaction = async (data: Omit<Transaction, 'id' | 'timestamp'>, endDate?: string) => {
      // 1. Create Account if needed (Optimistic)
      if (data.accountName) {
         const exists = accounts.some(a => a.name === data.accountName);
         if (!exists) {
             await handleCreateAccount(data.accountName, data.category as AccountType);
         }
      }

      // --- AUTO-ADJUST DATE FILTER (CASHBOOK RULE) ---
      const txDate = data.date;
      const isRangeTransaction = endDate && endDate > txDate;

      if (isRangeTransaction) {
          setDateFilter({
              mode: 'range',
              singleDate: txDate, 
              fromDate: txDate,
              toDate: endDate
          });
      } else {
          const isInsideActiveRange = 
              dateFilter.mode === 'range' && 
              txDate >= dateFilter.fromDate && 
              txDate <= dateFilter.toDate;

          if (!isInsideActiveRange) {
              setDateFilter({
                  mode: 'single',
                  singleDate: txDate,
                  fromDate: txDate,
                  toDate: txDate
              });
          }
      }

      // Optimistic Updates
      const tempId = Date.now();
      
      if (editingTransaction) {
          // UPDATE
          const updatedTx = { ...editingTransaction, ...data };
          setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? updatedTx : t));
          
          // Background Sync
          TransactionService.update(updatedTx).catch(e => {
              console.error("Update tx failed", e);
              // Revert logic would go here
          });
      } else {
          // CREATE
          if (endDate && endDate !== data.date) {
              const dates = getDatesInRange(data.date, endDate);
              const newTxs: Transaction[] = dates.map((d, i) => ({
                  ...data,
                  id: tempId + i,
                  date: d,
                  timestamp: Date.now() + i
              }));
              
              setTransactions(prev => [...prev, ...newTxs]);

              // Background Sync - Sequential to maintain order if important
              (async () => {
                  try {
                      for (const d of dates) {
                          await TransactionService.create({ ...data, date: d, timestamp: Date.now() });
                      }
                  } catch (e) {
                      console.error("Batch create failed", e);
                  }
              })();

          } else {
              const newTx: Transaction = {
                  ...data,
                  id: tempId,
                  timestamp: Date.now()
              };
              setTransactions(prev => [...prev, newTx]);

              // Background Sync
              TransactionService.create({ ...data, timestamp: Date.now() })
                  .then(realTx => {
                      // Replace temp ID with real ID
                      setTransactions(prev => prev.map(t => t.id === tempId ? realTx : t));
                  })
                  .catch(e => {
                      console.error("Create tx failed", e);
                      setTransactions(prev => prev.filter(t => t.id !== tempId));
                  });
          }
      }
      setEditingTransaction(null);
      // No need to call refreshAccounts() for balances, as they are derived from transactions state
  };

  const handleDeleteTransaction = async (id: number) => {
      if (window.confirm(t.confirmDelete)) {
          // Optimistic
          setTransactions(prev => prev.filter(t => t.id !== id));
          
          // Background
          try {
              await TransactionService.delete(id);
          } catch (e) {
              console.error("Delete tx failed", e);
              // Typically we'd reload data here if it failed
          }
      }
  };
  
  const openTransactionModal = (mode: TransactionType, defaults?: { category?: string, accountName?: string }, editData?: Transaction) => {
      setModalMode(mode);
      setModalDefaults(defaults || {});
      setEditingTransaction(editData || null);
      setIsModalOpen(true);
  };

  // Opening Balance Modal Handlers
  const openBalanceModal = () => {
      setTempOpeningBalance({
          cash: initialOpeningBalance.cash.toString(),
          online: initialOpeningBalance.online.toString()
      });
      setIsBalanceModalOpen(true);
  };

  const saveOpeningBalance = async () => {
      const newVal = {
          cash: parseFloat(tempOpeningBalance.cash) || 0,
          online: parseFloat(tempOpeningBalance.online) || 0
      };
      // Optimistic
      setInitialOpeningBalance(newVal);
      setIsBalanceModalOpen(false);
      
      // Sync
      SettingsService.set('openingBalanceData', newVal);
  };

  // Stock Handlers (Optimistic)
  const handleAddStockMovement = async (m: StockMovement) => {
      // Optimistic
      setStockMovements(prev => [...prev, m]);
      
      // Sync
      try {
          const saved = await StockService.create(m);
          // Replace with real ID
          setStockMovements(prev => prev.map(item => item.id === m.id ? saved : item));
      } catch (e) {
          console.error("Add stock failed", e);
          setStockMovements(prev => prev.filter(item => item.id !== m.id));
      }
  };

  const handleUpdateStockMovement = async (m: StockMovement) => {
      // Optimistic
      setStockMovements(prev => prev.map(item => item.id === m.id ? m : item));
      
      // Sync
      StockService.update(m).catch(e => console.error("Update stock failed", e));
  };

  const handleDeleteStockMovement = async (id: number) => {
      if (window.confirm(t.confirmDelete)) {
          // Optimistic
          setStockMovements(prev => prev.filter(item => item.id !== id));
          // Sync
          StockService.delete(id).catch(e => console.error("Delete stock failed", e));
      }
  };

  // Specific Account Handlers (Optimistic Deep Updates)
  const handleToggleAttendance = async (accountName: string, date: string, isPresent: boolean) => {
     // Optimistic Update
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.name === accountName) {
             const newAttendance = { ...acc.attendance };
             if (isPresent) newAttendance[date] = true;
             else delete newAttendance[date];
             return { ...acc, attendance: newAttendance };
         }
         return acc;
     }));

     // Sync
     AccountService.toggleAttendance(accountName, date, isPresent);
  };

  const handleToggleHisaab = async (accountName: string, date: string, isHisaab: boolean) => {
     // Optimistic Update
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.name === accountName) {
             const newHisaab = { ...acc.hisaabDays };
             if (isHisaab) newHisaab[date] = true;
             else delete newHisaab[date];
             return { ...acc, hisaabDays: newHisaab };
         }
         return acc;
     }));

     // Sync
     AccountService.toggleHisaab(accountName, date, isHisaab);
  };

  const handleAddAdjustment = async (accountName: string, adj: {date: string, amount: number, note: string}) => {
     // Temp ID
     const tempAdj: ManualAdjustment = { ...adj, id: Date.now() };
     
     // Optimistic Update
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.name === accountName) {
             return { ...acc, manualAdjustments: [...(acc.manualAdjustments || []), tempAdj] };
         }
         return acc;
     }));

     // Sync
     try {
         const savedAdj = await AccountService.addAdjustment(accountName, adj);
         // Replace ID
         setAccounts(prevAccounts => prevAccounts.map(acc => {
             if (acc.name === accountName) {
                 return { 
                     ...acc, 
                     manualAdjustments: acc.manualAdjustments?.map(a => a.id === tempAdj.id ? savedAdj : a) 
                 };
             }
             return acc;
         }));
     } catch (e) {
         console.error("Add adjustment failed", e);
     }
  };

  const handleUpdateAdjustment = async (adj: ManualAdjustment) => {
     // Optimistic Update
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.manualAdjustments?.some(a => a.id === adj.id)) {
             return {
                 ...acc,
                 manualAdjustments: acc.manualAdjustments.map(a => a.id === adj.id ? adj : a)
             };
         }
         return acc;
     }));

     // Sync
     AccountService.updateAdjustment(adj);
  };

  const handleDeleteAdjustment = async (id: number) => {
     // Optimistic Update
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.manualAdjustments?.some(a => a.id === id)) {
             return {
                 ...acc,
                 manualAdjustments: acc.manualAdjustments.filter(a => a.id !== id)
             };
         }
         return acc;
     }));

     // Sync
     AccountService.deleteAdjustment(id);
  };

  // Save Translation Cache
  useEffect(() => {
     if (Object.keys(translationCache.hi).length > 0 || Object.keys(translationCache.pa).length > 0) {
        SettingsService.set('translationCache', translationCache);
     }
  }, [translationCache]);

  // --- Translation Logic ---
  const getTranslated = (text?: string): string => {
    if (!text) return "";
    if (language === 'en') return text;
    const cache = translationCache[language];
    return cache && cache[text] ? cache[text] : text;
  };

  const handleTranslateData = async () => {
      if (language === 'en') return;
      setIsTranslating(true);
      
      const textsToTranslate = new Set<string>();
      
      // Accounts
      accounts.forEach(a => textsToTranslate.add(a.name));
      
      // Transactions
      transactions.forEach(t => {
          if(t.accountName) textsToTranslate.add(t.accountName);
          if(t.details) textsToTranslate.add(t.details);
      });
      
      // Stock
      stockMovements.forEach(m => {
          if(m.accountName) textsToTranslate.add(m.accountName);
          if(m.note) textsToTranslate.add(m.note);
      });

      // Filter out already translated
      const currentCache = translationCache[language] || {};
      const pendingTexts = Array.from(textsToTranslate).filter(t => !currentCache[t]);

      if (pendingTexts.length === 0) {
          setIsTranslating(false);
          return;
      }

      try {
          if (language === 'hi' || language === 'pa') {
              const result = await translateBatch(pendingTexts, language);
              
              setTranslationCache(prev => ({
                  ...prev,
                  [language]: {
                      ...prev[language],
                      ...result
                  }
              }));
          }
      } catch (e) {
          console.error("Translation error", e);
      } finally {
          setIsTranslating(false);
      }
  };

  // --- Logic: Calculations ---

  const displayedTransactions = useMemo(() => {
      let filtered = transactions;
      if (dateFilter.mode === 'single') {
          filtered = filtered.filter(t => t.date === dateFilter.singleDate);
      } else {
          filtered = filtered.filter(t => t.date >= dateFilter.fromDate && t.date <= dateFilter.toDate);
      }
      return filtered.sort((a,b) => a.timestamp - b.timestamp);
  }, [transactions, dateFilter]);

  // Previous Balance: Initial + (Income - Expense) before start date
  const previousBalance = useMemo(() => {
      const startDate = dateFilter.mode === 'single' ? dateFilter.singleDate : dateFilter.fromDate;
      
      let cash = initialOpeningBalance.cash;
      let online = initialOpeningBalance.online;

      transactions.forEach(t => {
          if (t.date < startDate) {
              if (t.type === 'income') {
                  if (t.paymentType === 'cash') cash += t.amount;
                  else online += t.amount;
              } else {
                  if (t.paymentType === 'cash') cash -= t.amount;
                  else online -= t.amount;
              }
          }
      });

      return { cash, online, total: cash + online };
  }, [transactions, dateFilter, initialOpeningBalance]);

  // Calculate Breakdown for Current View (Filtered Transactions)
  const currentViewStats = useMemo(() => {
      let cashIn = 0;
      let onlineIn = 0;
      let cashOut = 0;
      let onlineOut = 0;

      displayedTransactions.forEach(t => {
          const isCash = t.paymentType === 'cash';
          if (t.type === 'income') {
              if (isCash) cashIn += t.amount;
              else onlineIn += t.amount;
          } else { // expense
              if (isCash) cashOut += t.amount;
              else onlineOut += t.amount;
          }
      });

      return { cashIn, onlineIn, cashOut, onlineOut };
  }, [displayedTransactions]);

  const totalIncome = currentViewStats.cashIn + currentViewStats.onlineIn;
  const totalExpense = currentViewStats.cashOut + currentViewStats.onlineOut;
  
  // Final Balances: Previous + Current Change
  const finalCashBalance = previousBalance.cash + currentViewStats.cashIn - currentViewStats.cashOut;
  const finalOnlineBalance = previousBalance.online + currentViewStats.onlineIn - currentViewStats.onlineOut;
  const finalTotalBalance = finalCashBalance + finalOnlineBalance;

  // Stats Logic
  const stats = useMemo(() => {
    let expense = 0;
    let labour = 0;
    let oil = 0;
    let partnerIn = 0;
    let electricity = 0;
    
    transactions.forEach(t => {
        if (t.date >= statsStartDate && t.date <= statsEndDate) {
            if (t.type === 'expense') {
                expense += t.amount;
                if (t.category === 'labour') {
                    labour += t.amount;
                }
                if (t.category === 'oil') {
                    oil += t.amount;
                }
                if (t.category === 'electricity') {
                    electricity += t.amount;
                }
            } else if (t.type === 'income' && t.category === 'partner') {
                partnerIn += t.amount;
            }
        }
    });

    let dispatchedKg = 0;
    stockMovements.forEach(m => {
        if (m.date >= statsStartDate && m.date <= statsEndDate && m.type === 'out') {
            dispatchedKg += m.quantityKg;
        }
    });

    const dispatchedQuintal = dispatchedKg / 100;
    const labourPerQuintal = dispatchedQuintal > 0 ? (labour / dispatchedQuintal) : 0;
    
    return { expense, labour, oil, electricity, partnerIn, dispatchedQuintal, labourPerQuintal };
  }, [transactions, stockMovements, statsStartDate, statsEndDate]);

  // Helpers
  const getCategoryLabel = (cat: string) => {
      if (cat === 'customer') return t.customerOption;
      if (cat === 'partner') return t.partnerOption;
      if (cat === 'shop') return t.shopOption;
      if (cat === 'labour') return t.labourOption;
      if (cat === 'oil') return t.oilOption;
      if (cat === 'electricity') return t.electricityOption;
      if (cat === 'supplier') return t.supplierOption;
      if (cat === 'cash_conversion') return "Internal Transfer";
      if (cat === 'other_income') return t.otherIncomeOption;
      return cat;
  };

  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
      );
  }

  return (
      <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
          {/* Header */}
          <header className="bg-white shadow z-10">
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                  <h1 className="text-xl font-bold text-gray-800">{t.pageTitle}</h1>
                  <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-600">{t.langLabel}</label>
                      <select 
                          value={language} 
                          onChange={(e) => setLanguage(e.target.value as Language)}
                          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                          <option value="en">English</option>
                          <option value="hi">हिंदी</option>
                          <option value="pa">ਪੰਜਾਬੀ</option>
                      </select>

                      {language !== 'en' && (
                          <button 
                             onClick={handleTranslateData}
                             disabled={isTranslating}
                             className={`ml-2 px-3 py-1 rounded text-sm font-bold shadow-sm flex items-center gap-2 transition ${isTranslating ? 'bg-gray-200 text-gray-500' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                             title="Translate all names and notes using AI"
                          >
                             {isTranslating ? (
                                 <>
                                   <svg className="animate-spin h-4 w-4 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                     <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                     <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                   </svg>
                                   {t.translating}
                                 </>
                             ) : (
                                 <>
                                    <span>🌐</span> {t.translateBtn}
                                 </>
                             )}
                          </button>
                      )}
                      
                      {/* AUTH USER PROFILE */}
                      <UserProfileHeader />
                  </div>
              </div>
              {/* Tabs */}
              <div className="flex overflow-x-auto bg-gray-50 border-t">
                  <button 
                      onClick={() => setActiveTab('transactions')}
                      className={`flex-1 py-3 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'transactions' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                      {t.tabTransactions}
                  </button>
                  <button 
                      onClick={() => setActiveTab('accounts')}
                      className={`flex-1 py-3 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'accounts' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                      {t.tabAccounts}
                  </button>
                  <button 
                      onClick={() => setActiveTab('stock')}
                      className={`flex-1 py-3 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'stock' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                      {t.tabStock}
                  </button>
                  <button 
                      onClick={() => setActiveTab('reports')}
                      className={`flex-1 py-3 px-4 font-bold text-sm whitespace-nowrap ${activeTab === 'reports' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                      {t.tabReports}
                  </button>
              </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 max-w-7xl mx-auto w-full p-4 overflow-hidden flex flex-col">
              {activeTab === 'transactions' && (
                  <div className="flex flex-col space-y-6">
                      
                      {/* Date Selection Card */}
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                           <div className="flex flex-col gap-2">
                               <h2 className="text-sm font-bold text-gray-500 uppercase">{t.dateSelectionTitle}</h2>
                               <div className="flex flex-col md:flex-row md:items-center gap-4">
                                   <div className="flex bg-gray-100 p-1 rounded w-fit">
                                       <button 
                                          onClick={() => setDateFilter(prev => ({ ...prev, mode: 'single' }))}
                                          className={`px-3 py-1 text-xs font-bold rounded transition ${dateFilter.mode === 'single' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                       >
                                          {t.singleDayLabel}
                                       </button>
                                       <button 
                                          onClick={() => setDateFilter(prev => ({ ...prev, mode: 'range' }))}
                                          className={`px-3 py-1 text-xs font-bold rounded transition ${dateFilter.mode === 'range' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                       >
                                          {t.dateRangeLabel}
                                       </button>
                                   </div>
                                   <div className="flex gap-2 items-center">
                                       {dateFilter.mode === 'single' ? (
                                           <DateInput 
                                              value={dateFilter.singleDate} 
                                              onChange={(d) => setDateFilter(prev => ({ ...prev, singleDate: d, fromDate: d, toDate: d }))}
                                           />
                                       ) : (
                                           <>
                                              <DateInput 
                                                  value={dateFilter.fromDate}
                                                  onChange={(d) => setDateFilter(prev => ({ ...prev, fromDate: d }))}
                                              />
                                              <span className="text-gray-400">➜</span>
                                              <DateInput 
                                                  value={dateFilter.toDate}
                                                  onChange={(d) => setDateFilter(prev => ({ ...prev, toDate: d }))}
                                              />
                                           </>
                                       )}
                                   </div>
                               </div>
                           </div>
                      </div>

                      {/* PREVIOUS BALANCE CARD */}
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white relative">
                            <button 
                                onClick={openBalanceModal}
                                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 p-2 rounded-full transition"
                                title={t.editOpeningBalanceTitle}
                            >
                                ✎
                            </button>

                            <h2 className="text-2xl font-bold mb-4 pr-10">{t.prevBalTitle}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                                    <p className="text-sm opacity-90">{t.cashBalLabel}</p>
                                    <p className="text-2xl font-bold">₹{formatIndianCurrency(previousBalance.cash)}</p>
                                </div>
                                <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                                    <p className="text-sm opacity-90">{t.onlineBalLabel}</p>
                                    <p className="text-2xl font-bold">₹{formatIndianCurrency(previousBalance.online)}</p>
                                </div>
                                <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                                    <p className="text-sm opacity-90">{t.totalBalLabel}</p>
                                    <p className="text-2xl font-bold">₹{formatIndianCurrency(previousBalance.total)}</p>
                                </div>
                            </div>
                      </div>

                      {/* INCOME TRANSACTIONS TABLE */}
                      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                          <div className="flex justify-between items-center mb-4">
                              <h2 className="text-xl font-bold text-green-600">{t.incomeTitle}</h2>
                              <button 
                                  onClick={() => openTransactionModal('income')}
                                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm"
                              >
                                  {t.addIncomeBtn}
                              </button>
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full">
                                  <thead className="bg-green-50">
                                      <tr>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.transactionDateLabel}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.nameLabel}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.detailsHeader}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.typeHeader}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.incomeTypeHeader}</th>
                                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t.amountHeader}</th>
                                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t.actionHeader}</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {displayedTransactions.filter(tr => tr.type === 'income').length === 0 && (
                                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t.noIncome}</td></tr>
                                      )}
                                      {displayedTransactions.filter(tr => tr.type === 'income').map(tr => (
                                          <tr key={tr.id} className="border-b hover:bg-gray-50">
                                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDisplayDate(tr.date)}</td>
                                              <td className="px-4 py-3 text-sm font-bold text-gray-800">{getTranslated(tr.accountName)}</td>
                                              <td className="px-4 py-3 text-sm text-gray-600">{getTranslated(tr.details)}</td>
                                              <td className="px-4 py-3">
                                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                      {tr.paymentType}
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3">
                                                  <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                      {getCategoryLabel(tr.category)}
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3 text-right font-bold text-green-600">₹{formatIndianCurrency(tr.amount)}</td>
                                              <td className="px-4 py-3 text-right">
                                                  <div className="flex justify-end items-center gap-2">
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); openTransactionModal(tr.type, {}, tr); }} 
                                                          className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition" 
                                                          title={t.editBtn}
                                                      >
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                          </svg>
                                                      </button>
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tr.id); }} 
                                                          className="text-red-500 hover:bg-red-50 p-2 rounded-full transition" 
                                                          title={t.deleteBtn}
                                                      >
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                          </svg>
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot className="bg-green-50 border-t border-green-200">
                                      <tr>
                                          <td colSpan={3} className="px-4 py-3 font-bold text-gray-800 text-left">
                                              {t.incomeTotalLabel} <span className="text-green-700 text-lg ml-2">₹{formatIndianCurrency(totalIncome)}</span>
                                          </td>
                                          <td colSpan={4}></td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>

                      {/* EXPENSE TRANSACTIONS TABLE */}
                      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                          <div className="flex justify-between items-center mb-4">
                              <h2 className="text-xl font-bold text-red-600">{t.expenseTitle}</h2>
                              <button 
                                  onClick={() => openTransactionModal('expense')}
                                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm"
                              >
                                  {t.addExpenseBtn}
                              </button>
                          </div>
                          <div className="overflow-x-auto">
                              <table className="w-full">
                                  <thead className="bg-red-50">
                                      <tr>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.transactionDateLabel}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.nameLabel}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.detailsHeader}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.typeHeader}</th>
                                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">{t.expenseTypeHeader}</th>
                                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t.amountHeader}</th>
                                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{t.actionHeader}</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {displayedTransactions.filter(tr => tr.type === 'expense').length === 0 && (
                                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t.noExpense}</td></tr>
                                      )}
                                      {displayedTransactions.filter(tr => tr.type === 'expense').map(tr => (
                                          <tr key={tr.id} className="border-b hover:bg-gray-50">
                                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDisplayDate(tr.date)}</td>
                                              <td className="px-4 py-3 text-sm font-bold text-gray-800">{getTranslated(tr.accountName)}</td>
                                              <td className="px-4 py-3 text-sm text-gray-600">{getTranslated(tr.details)}</td>
                                              <td className="px-4 py-3">
                                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                      {tr.paymentType}
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3">
                                                  <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
                                                      {getCategoryLabel(tr.category)}
                                                  </span>
                                              </td>
                                              <td className="px-4 py-3 text-right font-bold text-red-600">₹{formatIndianCurrency(tr.amount)}</td>
                                              <td className="px-4 py-3 text-right">
                                                  <div className="flex justify-end items-center gap-2">
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); openTransactionModal(tr.type, {}, tr); }} 
                                                          className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition" 
                                                          title={t.editBtn}
                                                      >
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                          </svg>
                                                      </button>
                                                      <button 
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tr.id); }} 
                                                          className="text-red-500 hover:bg-red-50 p-2 rounded-full transition" 
                                                          title={t.deleteBtn}
                                                      >
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                          </svg>
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot className="bg-red-50 border-t border-red-200">
                                      <tr>
                                          <td colSpan={3} className="px-4 py-3 font-bold text-gray-800 text-left">
                                              {t.expenseTotalLabel} <span className="text-red-700 text-lg ml-2">₹{formatIndianCurrency(totalExpense)}</span>
                                          </td>
                                          <td colSpan={4}></td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>

                      {/* FINAL BALANCE CARD */}
                      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white text-center md:text-left">
                          <h2 className="text-2xl font-bold mb-4">{t.finalBalanceTitle}</h2>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                                  <p className="text-sm opacity-90">{t.cashBalLabel}</p>
                                  <p className="text-2xl font-bold">₹{formatIndianCurrency(finalCashBalance)}</p>
                              </div>
                              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm">
                                  <p className="text-sm opacity-90">{t.onlineBalLabel}</p>
                                  <p className="text-2xl font-bold">₹{formatIndianCurrency(finalOnlineBalance)}</p>
                              </div>
                              <div className="bg-white/20 rounded-lg p-4 backdrop-blur-sm border-2 border-white/30">
                                  <p className="text-sm opacity-90">{t.totalBalLabel}</p>
                                  <p className="text-2xl font-bold">₹{formatIndianCurrency(finalTotalBalance)}</p>
                              </div>
                          </div>
                      </div>

                      {/* --- SUMMARY REPORT (STATS) SECTION --- */}
                      <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-indigo-500">
                          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.statsTitle}</h2>
                          
                          <div className="flex flex-col md:flex-row gap-4 mb-8">
                              <div className="w-full md:w-64">
                                  <DateInput 
                                      label={t.fromDateLabel}
                                      value={statsStartDate} 
                                      onChange={setStatsStartDate}
                                  />
                              </div>
                              <div className="w-full md:w-64">
                                  <DateInput 
                                      label={t.toDateLabel}
                                      value={statsEndDate} 
                                      onChange={setStatsEndDate}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                              {/* Total Expense */}
                              <div className="p-5 bg-red-50 rounded-lg border border-red-100 shadow-sm">
                                   <p className="text-xs uppercase tracking-wide font-bold text-red-500 mb-1">{t.statsTotalExpense}</p>
                                   <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(stats.expense)}</p>
                              </div>
                              {/* Labour Expense */}
                              <div className="p-5 bg-orange-50 rounded-lg border border-orange-100 shadow-sm">
                                   <p className="text-xs uppercase tracking-wide font-bold text-orange-500 mb-1">{t.statsLabourExpense}</p>
                                   <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(stats.labour)}</p>
                              </div>
                              {/* Oil Expense */}
                              <div className="p-5 bg-yellow-50 rounded-lg border border-yellow-100 shadow-sm">
                                   <p className="text-xs uppercase tracking-wide font-bold text-yellow-600 mb-1">{t.statsOilExpense}</p>
                                   <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(stats.oil)}</p>
                              </div>
                              {/* Electricity Expense */}
                              <div className="p-5 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                                      <p className="text-xs uppercase tracking-wide font-bold text-blue-600 mb-1">{t.statsElectricityExpense}</p>
                                      <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(stats.electricity)}</p>
                              </div>
                              {/* Dispatch / Labour Cost */}
                              <div className="p-5 bg-purple-50 rounded-lg border border-purple-100 shadow-sm md:col-span-2 lg:col-span-1">
                                       <p className="text-xs uppercase tracking-wide font-bold text-purple-600 mb-1">{t.statsLabourPerQuintal}</p>
                                       <div className="flex items-baseline gap-2">
                                           <p className="text-2xl font-bold text-gray-800">₹{stats.labourPerQuintal.toFixed(2)}</p>
                                           <span className="text-xs text-gray-500">/ Quintal</span>
                                       </div>
                                       <p className="text-[10px] text-gray-400 mt-1">({stats.dispatchedQuintal.toFixed(2)} Q Dispatched)</p>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'accounts' && (
                  <AccountPageController 
                      transactions={transactions}
                      stockMovements={stockMovements}
                      t={t}
                      accounts={accounts}
                      onAddAccount={handleCreateAccount}
                      onUpdateAccount={handleUpdateAccount}
                      onOpenTransactionModal={openTransactionModal}
                      getTranslated={getTranslated}
                      // Pass granular handlers
                      onToggleAttendance={handleToggleAttendance}
                      onToggleHisaab={handleToggleHisaab}
                      onAddAdjustment={handleAddAdjustment}
                      onUpdateAdjustment={handleUpdateAdjustment}
                      onDeleteAdjustment={handleDeleteAdjustment}
                  />
              )}

              {activeTab === 'stock' && (
                  <StockPageController 
                      t={t}
                      language={language}
                      stockMovements={stockMovements}
                      transactions={transactions}
                      accounts={accounts}
                      onAddStockMovement={handleAddStockMovement}
                      onUpdateStockMovement={handleUpdateStockMovement}
                      onDeleteStockMovement={handleDeleteStockMovement}
                      onAddTransaction={handleAddTransaction}
                      onAddAccount={handleCreateAccount}
                      onUpdateAccount={handleUpdateAccount}
                      getTranslated={getTranslated}
                  />
              )}

              {activeTab === 'reports' && (
                  <ReportsPageController 
                      transactions={transactions}
                      t={t}
                      language={language}
                      getTranslated={getTranslated}
                  />
              )}
          </main>

          {/* Transaction Modal */}
          <TransactionModal 
              isOpen={isModalOpen}
              onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
              onSubmit={handleAddTransaction}
              initialData={editingTransaction}
              mode={modalMode}
              t={t}
              availableAccounts={accounts}
              defaultCategory={modalDefaults.category}
              defaultAccountName={modalDefaults.accountName}
          />

          {/* Opening Balance Modal */}
          {isBalanceModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl animate-fade-in">
                      <h3 className="text-xl font-bold mb-4">{t.editOpeningBalanceTitle}</h3>
                      <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.initialCashLabel}</label>
                          <input 
                              type="number"
                              value={tempOpeningBalance.cash}
                              onChange={(e) => setTempOpeningBalance(prev => ({ ...prev, cash: e.target.value }))}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                      </div>
                      <div className="mb-6">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">{t.initialOnlineLabel}</label>
                          <input 
                              type="number"
                              value={tempOpeningBalance.online}
                              onChange={(e) => setTempOpeningBalance(prev => ({ ...prev, online: e.target.value }))}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                      </div>
                      <div className="flex gap-3">
                          <button 
                              onClick={saveOpeningBalance} 
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition"
                          >
                              {t.saveBtn}
                          </button>
                          <button 
                              onClick={() => setIsBalanceModalOpen(false)} 
                              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition"
                          >
                              {t.cancelBtn}
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
};

// ... (App wrapper remains same)
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGuard>
        <FinancialApp />
      </AuthGuard>
    </AuthProvider>
  );
};

export default App;