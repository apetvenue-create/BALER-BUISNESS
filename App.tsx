
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Transaction, 
  TransactionType, 
  Translation, 
  Language,
  StoredAccount,
  AccountType,
  DateFilter,
  StockMovement,
  ManualAdjustment,
  OwnerPreviousEntry
} from './types';
import { TRANSLATIONS } from './constants';
import { getDatesInRange, formatIndianCurrency, formatDisplayDate, formatISODateLocal, formatInputCurrency, parseCurrency } from './utils';
import {
  loadOwnerPreviousLocal,
  mergeOwnerPreviousEntries,
  persistOwnerPreviousForAccount,
  renameOwnerPreviousLocalKey
} from './utils/ownerPreviousLocal';
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
    <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Logged in as</p>
            <p className="text-sm font-semibold text-gray-700">{session.name || session.email}</p>
        </div>
        <button 
            type="button"
            onClick={() => {
                if(window.confirm("Are you sure you want to logout?")) {
                    signOut();
                }
            }}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2.5 rounded-xl transition-all cursor-pointer"
            title="Logout"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-5 h-5">
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
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[language];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
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
  
  const todayStr = useMemo(() => formatISODateLocal(new Date()), []);
  const monthStartStr = useMemo(
      () => formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      []
  );
  const monthEndStr = useMemo(
      () => formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)),
      []
  );

  // Cashbook State
  const [dateFilter, setDateFilter] = useState<DateFilter>({
      mode: 'range',
      singleDate: todayStr,
      fromDate: monthStartStr,
      toDate: monthEndStr
  });

  // Opening Balance State (Manually set start values)
  const [initialOpeningBalance, setInitialOpeningBalance] = useState({ cash: 0, online: 0 });
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [tempOpeningBalance, setTempOpeningBalance] = useState({ cash: '0', online: '0' });
  const openingBalanceFormRef = useRef<HTMLFormElement | null>(null);
  const openingBalanceSubmittingRef = useRef(false);

  // Stats Section State
  const [statsStartDate, setStatsStartDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [statsEndDate, setStatsEndDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  );
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalDefaults, setModalDefaults] = useState<{ category?: string, accountName?: string }>({});

  const [isLoading, setIsLoading] = useState(true);

  // ---- Local outbox for transactions (prevents “disappears after refresh”) ----
  // If Supabase insert fails / is pending and the user refreshes, we keep the tx locally
  // and auto-sync it on next load.
  const TX_OUTBOX_KEY = 'pendingTransactions_v1';
  const readTxOutbox = (): Omit<Transaction, 'id'>[] => {
    try {
      const raw = localStorage.getItem(TX_OUTBOX_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const writeTxOutbox = (list: Omit<Transaction, 'id'>[]) => {
    try {
      localStorage.setItem(TX_OUTBOX_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  };
  const txFingerprint = (t: Omit<Transaction, 'id'>) =>
    [
      t.type,
      t.category,
      (t.accountName || '').trim(),
      (t.details || '').trim(),
      String(t.amount),
      t.paymentType,
      t.date
    ].join('|');
  const outboxAddMany = (items: Omit<Transaction, 'id'>[]) => {
    if (!items.length) return;
    const existing = readTxOutbox();
    const set = new Set(existing.map(txFingerprint));
    const merged = [...existing];
    for (const it of items) {
      const fp = txFingerprint(it);
      if (set.has(fp)) continue;
      set.add(fp);
      merged.push(it);
    }
    writeTxOutbox(merged);
  };
  const outboxRemoveMany = (items: Omit<Transaction, 'id'>[]) => {
    if (!items.length) return;
    const remove = new Set(items.map(txFingerprint));
    const next = readTxOutbox().filter(it => !remove.has(txFingerprint(it)));
    writeTxOutbox(next);
  };
  /** Names hidden from Ledgers list only (transactions / stock unchanged). */
  const [hiddenLedgerAccounts, setHiddenLedgerAccounts] = useState<string[]>([]);
  /** Minimal metadata to allow restoring previously removed ledger accounts. */
  const [removedLedgerAccounts, setRemovedLedgerAccounts] = useState<StoredAccount[]>([]);

  /** Upload entries that only exist locally (negative id) after failed DB insert. */
  const syncPendingOwnerPreviousToSupabase = async (merged: StoredAccount[]) => {
    for (const acc of merged) {
      if (acc.type !== 'partner') continue;
      const list = acc.ownerPreviousEntries || [];
      for (const e of list) {
        if (e.id >= 0) continue;
        try {
          const saved = await AccountService.addOwnerPreviousEntry(acc.name, {
            date: e.date,
            amount: e.amount,
            kind: e.kind,
            note: e.note
          });
          setAccounts(prev => {
            const next = prev.map(a =>
              a.name === acc.name && a.type === 'partner'
                ? {
                      ...a,
                      ownerPreviousEntries: (a.ownerPreviousEntries || []).map(x =>
                        x.id === e.id ? saved : x
                      )
                    }
                : a
            );
            const p = next.find(x => x.name === acc.name && x.type === 'partner');
            persistOwnerPreviousForAccount(acc.name, p?.ownerPreviousEntries || []);
            return next;
          });
        } catch (err) {
          console.warn('Could not sync owner previous entry to Supabase:', err);
        }
      }
    }
  };

  /**
   * Attendance writes can happen rapidly (double clicks, lag, retries).
   * Track the latest intent per (account,date) so "last action wins" and
   * older in-flight requests don't overwrite newer state on the server.
   */
  const attendanceWriteSeqRef = useRef<Record<string, number>>({});

  // --- Initial Data Load (Migration from LocalStorage to Supabase) ---
  const loadData = async () => {
      setIsLoading(true);
      try {
          // Load core data first, then settings — reduces burst that triggers Supabase 429
          const [txsResult, accsResult, stocksResult] = await Promise.allSettled([
              TransactionService.getAll(),
              AccountService.getAll(),
              StockService.getAll(),
          ]);
          const [obResult, transCacheResult, hiddenLedgerResult, removedLedgerResult] = await Promise.allSettled([
              SettingsService.get('openingBalanceData'),
              SettingsService.get('translationCache'),
              SettingsService.get('hiddenLedgerAccounts'),
              SettingsService.get('removedLedgerAccounts'),
          ]);

          const txs = txsResult.status === 'fulfilled' ? txsResult.value : [];
          const accs = accsResult.status === 'fulfilled' ? accsResult.value : [];
          const stocks = stocksResult.status === 'fulfilled' ? stocksResult.value : [];
          const ob = obResult.status === 'fulfilled' ? obResult.value : null;
          const transCache = transCacheResult.status === 'fulfilled' ? transCacheResult.value : null;
          const hiddenLedger = hiddenLedgerResult.status === 'fulfilled' ? hiddenLedgerResult.value : [];
          const removedLedger = removedLedgerResult.status === 'fulfilled' ? removedLedgerResult.value : [];

          // Merge any locally pending txs so they don't disappear on refresh.
          // Then try to sync them in background.
          const pending = readTxOutbox();
          const serverSet = new Set(txs.map(t => txFingerprint(t)));
          const pendingNotOnServer = pending.filter(p => !serverSet.has(txFingerprint(p)));
          const pendingAsTxs: Transaction[] = pendingNotOnServer.map((p, i) => ({
            ...p,
            id: -(Date.now() + i + 1), // negative id = local-only
            timestamp: typeof p.timestamp === 'number' ? p.timestamp : Date.now()
          }));

          setTransactions([...txs, ...pendingAsTxs]);
          setHiddenLedgerAccounts(Array.isArray(hiddenLedger) ? hiddenLedger : []);
          setRemovedLedgerAccounts(Array.isArray(removedLedger) ? removedLedger : []);
          const localOwnerPrev = loadOwnerPreviousLocal();
          const accsMerged = accs.map(acc => {
            if (acc.type !== 'partner') return acc;
            return {
              ...acc,
              ownerPreviousEntries: mergeOwnerPreviousEntries(
                acc.ownerPreviousEntries || [],
                localOwnerPrev[acc.name] || []
              )
            };
          });
          setAccounts(accsMerged);
          void syncPendingOwnerPreviousToSupabase(accsMerged);
          setStockMovements(stocks);
          if (ob) setInitialOpeningBalance(ob);
          if (transCache) setTranslationCache(transCache);

          // Background: sync pending txs
          if (pendingNotOnServer.length) {
            (async () => {
              const created: Omit<Transaction, 'id'>[] = [];
              for (const p of pendingNotOnServer) {
                try {
                  await TransactionService.create(p);
                  created.push(p);
                } catch (e) {
                  // keep in outbox
                }
              }
              if (created.length) {
                outboxRemoveMany(created);
                const all = await TransactionService.getAll().catch(() => null);
                if (all) setTransactions(all);
              }
            })();
          }
          
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

      const nextHiddenCreate = hiddenLedgerAccounts.filter(
          n => n.toLowerCase() !== name.toLowerCase()
      );
      if (nextHiddenCreate.length < hiddenLedgerAccounts.length) {
          setHiddenLedgerAccounts(nextHiddenCreate);
          void SettingsService.set('hiddenLedgerAccounts', nextHiddenCreate);
      }

      const safeType: AccountType = ['labour', 'partner', 'customer', 'supplier', 'other'].includes(type) ? type : 'other';
      
      const newAccount: StoredAccount = {
          name,
          type: safeType,
          rate,
          attendance: {},
          hisaabDays: {},
          manualAdjustments: [],
          ...(safeType === 'partner' ? { ownerPreviousEntries: [] as OwnerPreviousEntry[] } : {})
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

  const handleRenameAccount = async (oldName: string, newName: string) => {
      const canonicalOld = oldName.trim();
      const canonicalNew = newName.trim();
      if (!canonicalNew) return;
      if (canonicalOld.toLowerCase() === canonicalNew.toLowerCase()) return;

      if (accounts.some(a => a.name.trim().toLowerCase() === canonicalNew.toLowerCase())) {
          alert(t.accountExists);
          return;
      }

      // 1. Update Accounts State
      setAccounts(prev =>
        prev.map(a =>
          a.name.trim().toLowerCase() === canonicalOld.toLowerCase()
            ? { ...a, name: canonicalNew }
            : a
        )
      );

      setHiddenLedgerAccounts(prev => {
          const has = prev.some(n => n.trim().toLowerCase() === canonicalOld.toLowerCase());
          if (!has) return prev;
          const next = prev.map(n =>
            n.trim().toLowerCase() === canonicalOld.toLowerCase() ? canonicalNew : n
          );
          SettingsService.set('hiddenLedgerAccounts', next).catch(() => {});
          return next;
      });

      // 2. Update Transactions State
      setTransactions(prev =>
        prev.map(t =>
          t.accountName && t.accountName.trim().toLowerCase() === canonicalOld.toLowerCase()
            ? { ...t, accountName: canonicalNew }
            : t
        )
      );

      // 3. Update Stock State
      setStockMovements(prev =>
        prev.map(m =>
          m.accountName && m.accountName.trim().toLowerCase() === canonicalOld.toLowerCase()
            ? { ...m, accountName: canonicalNew }
            : m
        )
      );

      // 4. Sync with Backend
      try {
          await AccountService.rename(canonicalOld, canonicalNew);
          renameOwnerPreviousLocalKey(canonicalOld, canonicalNew);
      } catch (e) {
          console.error("Rename failed", e);
          alert("Failed to update name on server. Please refresh.");
          // In a real app, revert state here
      }
  };

  const handleDeleteAccount = async (accountName: string) => {
      const canonicalName = accountName.trim();
      const prevAccounts = accounts;
      const prevHidden = hiddenLedgerAccounts;
      const prevRemoved = removedLedgerAccounts;

      const removedMeta = accounts.find(a => a.name.trim().toLowerCase() === canonicalName.toLowerCase());

      const nextHidden = [
          ...new Set([...hiddenLedgerAccounts.map(n => n.trim()), canonicalName])
      ];
      setHiddenLedgerAccounts(nextHidden);
      setAccounts(prev => prev.filter(a => a.name.trim().toLowerCase() !== canonicalName.toLowerCase()));
      if (removedMeta) {
          const nextRemoved = prevRemoved.some(a => a.name.trim().toLowerCase() === removedMeta.name.trim().toLowerCase())
              ? prevRemoved
              : [...prevRemoved, {
                    ...removedMeta,
                    // Ensure canonical formatting for the key fields
                    name: removedMeta.name.trim()
                }];
          setRemovedLedgerAccounts(nextRemoved);
          void SettingsService.set('removedLedgerAccounts', nextRemoved);
      }

      try {
          await SettingsService.set('hiddenLedgerAccounts', nextHidden);
      } catch (e) {
          console.warn('hiddenLedgerAccounts save failed', e);
      }

      try {
          const orderMap = await SettingsService.get('accountOrderMap');
          if (orderMap && typeof orderMap === 'object' && canonicalName in orderMap) {
              const { [canonicalName]: _removed, ...rest } = orderMap as Record<string, number>;
              await SettingsService.set('accountOrderMap', rest);
          }
      } catch (e) {
          console.warn('accountOrderMap cleanup failed', e);
      }

      try {
          await AccountService.removeAccountFromLedger(canonicalName);
      } catch (e) {
          console.error('Remove account from ledger failed', e);
          setAccounts(prevAccounts);
          setHiddenLedgerAccounts(prevHidden);
          setRemovedLedgerAccounts(prevRemoved);
          await SettingsService.set('hiddenLedgerAccounts', prevHidden).catch(() => {});
          await SettingsService.set('removedLedgerAccounts', prevRemoved).catch(() => {});
          alert(t.accountDeleteFailed);
      }
  };

  const handleRestoreLedgerAccount = async (account: StoredAccount) => {
      const canonicalName = account.name.trim();
      const prevAccounts = accounts;
      const prevHidden = hiddenLedgerAccounts;
      const prevRemoved = removedLedgerAccounts;

      const nextHidden = hiddenLedgerAccounts
        .map(n => n.trim())
        .filter(n => n.toLowerCase() !== canonicalName.toLowerCase());
      const nextRemoved = removedLedgerAccounts.filter(a => a.name.trim().toLowerCase() !== canonicalName.toLowerCase());

      // Optimistic UI: show it again in ledgers
      setHiddenLedgerAccounts(nextHidden);
      setRemovedLedgerAccounts(nextRemoved);
      if (!accounts.some(a => a.name.trim().toLowerCase() === canonicalName.toLowerCase())) {
          setAccounts(prev => [...prev, { ...account, name: canonicalName }]);
      }
      void SettingsService.set('hiddenLedgerAccounts', nextHidden);
      void SettingsService.set('removedLedgerAccounts', nextRemoved);

      try {
          // Re-create the accounts row in Supabase so it shows up again.
          await AccountService.create(canonicalName, account.type, account.rate);
      } catch (e) {
          console.error('Restore account failed', e);
          setAccounts(prevAccounts);
          setHiddenLedgerAccounts(prevHidden);
          setRemovedLedgerAccounts(prevRemoved);
          void SettingsService.set('hiddenLedgerAccounts', prevHidden);
          void SettingsService.set('removedLedgerAccounts', prevRemoved);
          alert("Failed to restore account on server. Please refresh.");
      }
  };

  const handleDeleteRemovedLedgerAccount = async (accountName: string) => {
      const canonicalName = accountName.trim();
      const prevRemoved = removedLedgerAccounts;

      const nextRemoved = removedLedgerAccounts.filter(
        a => a.name.trim().toLowerCase() !== canonicalName.toLowerCase()
      );
      setRemovedLedgerAccounts(nextRemoved);
      try {
          await SettingsService.set('removedLedgerAccounts', nextRemoved);
      } catch (e) {
          console.warn('removedLedgerAccounts save failed', e);
          setRemovedLedgerAccounts(prevRemoved);
      }
  };

  const handleUpdateAccount = async (updated: StoredAccount) => {
      // Not typically used directly in UI, usually granular updates
  };

  const handleAddTransaction = async (data: Omit<Transaction, 'id' | 'timestamp'>) => {
      // 1. Create Account if needed (Optimistic)
      if (data.accountName) {
         const exists = accounts.some(a => a.name === data.accountName);
         if (!exists) {
             await handleCreateAccount(data.accountName, data.category as AccountType);
         }
      }

      // --- AUTO-ADJUST DATE FILTER (CASHBOOK RULE) ---
      const txDate = data.date;
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

      // Optimistic Updates
      const tempId = Date.now();
      
      if (editingTransaction) {
          const prevTx = editingTransaction;
          const updatedTx = { ...prevTx, ...data };

          const wasCashConversion = prevTx.category === 'cash_conversion';
          const isCashConversion = data.category === 'cash_conversion';

          // Special handling when entering/leaving ONLINE -> CASH.
          // Reason: cash_conversion is stored as TWO rows (expense online + income cash).
          if (wasCashConversion || isCashConversion) {
            // 1) Optimistic UI: remove previous row(s) and add the new representation
            setTransactions(prev => {
              const removeSet = new Set<number>();

              // If previous was cash conversion, remove all matching cash_conversion rows for that signature
              if (wasCashConversion) {
                const matchingPrev = prev.filter(other => {
                  if (other.category !== 'cash_conversion') return false;
                  if (other.date !== prevTx.date) return false;
                  if (other.amount !== prevTx.amount) return false;
                  const isExpenseOnline = other.type === 'expense' && other.paymentType === 'online';
                  const isIncomeCash = other.type === 'income' && other.paymentType === 'cash';
                  return isExpenseOnline || isIncomeCash;
                });
                for (const m of matchingPrev) removeSet.add(m.id);
              } else {
                removeSet.add(prevTx.id);
              }

              const next = prev.filter(t => !removeSet.has(t.id));

              if (isCashConversion) {
                const tempBase = Date.now();
                const pair = [
                  {
                    ...updatedTx,
                    id: tempBase,
                    timestamp: tempBase,
                    type: 'expense' as any,
                    category: 'cash_conversion',
                    accountName: '',
                    paymentType: 'online' as any,
                    details: (updatedTx.details || '').trim() || 'ONLINE -> CASH'
                  },
                  {
                    ...updatedTx,
                    id: tempBase + 1,
                    timestamp: tempBase + 1,
                    type: 'income' as any,
                    category: 'cash_conversion',
                    accountName: '',
                    paymentType: 'cash' as any,
                    details: (updatedTx.details || '').trim() || 'ONLINE -> CASH'
                  }
                ] as Transaction[];
                return [...next, ...pair];
              }

              // Leaving cash conversion: show as a normal single tx (with same id)
              return [...next, { ...updatedTx, id: prevTx.id }];
            });

            // 2) Background sync: delete old representation, create new, then re-sync
            (async () => {
              try {
                // Delete old rows if needed
                if (wasCashConversion) {
                  const ids = transactions
                    .filter(other => {
                      if (other.category !== 'cash_conversion') return false;
                      if (other.date !== prevTx.date) return false;
                      if (other.amount !== prevTx.amount) return false;
                      const isExpenseOnline = other.type === 'expense' && other.paymentType === 'online';
                      const isIncomeCash = other.type === 'income' && other.paymentType === 'cash';
                      return isExpenseOnline || isIncomeCash;
                    })
                    .map(x => x.id);
                  const unique = Array.from(new Set(ids));
                  await Promise.all(unique.map(txId => TransactionService.delete(txId)));
                } else {
                  await TransactionService.delete(prevTx.id);
                }

                // Create the new representation
                if (isCashConversion) {
                  await TransactionService.create({
                    ...updatedTx,
                    type: 'expense',
                    category: 'cash_conversion',
                    accountName: '',
                    paymentType: 'online' as any,
                    timestamp: Date.now(),
                    details: (updatedTx.details || '').trim() || 'ONLINE -> CASH'
                  });
                } else {
                  await TransactionService.create({
                    ...updatedTx,
                    timestamp: Date.now()
                  });
                }

                const all = await TransactionService.getAll();
                setTransactions(all);
              } catch (e) {
                console.error("Update (cash conversion) failed", e);
                const all = await TransactionService.getAll().catch(() => null);
                if (all) setTransactions(all);
              }
            })();
          } else {
            // Normal UPDATE (single row)
            setTransactions(prev => prev.map(t => t.id === prevTx.id ? updatedTx : t));

            // Background Sync
            TransactionService.update(updatedTx).catch(e => {
              console.error("Update tx failed", e);
              // Revert logic would go here
            });
          }
      } else {
          // CREATE
          const isCashConversion = data.category === 'cash_conversion';
          const makeCashConversionPair = (d: string, baseId: number, baseTs: number): Transaction[] => {
            const amount = data.amount;
            const common = {
              ...data,
              date: d,
              accountName: '', // internal transfer
              details: data.details?.trim() || 'Online to Cash Transfer',
            };

            // Expense: money leaves Online
            const outTx: Transaction = {
              ...common,
              id: baseId,
              timestamp: baseTs,
              type: 'expense',
              paymentType: 'online' as any,
            };

            // Income: money enters Cash
            const inTx: Transaction = {
              ...common,
              id: baseId + 1,
              timestamp: baseTs + 1,
              type: 'income',
              paymentType: 'cash' as any,
            };

            // Keep the same category so it can be identified as internal transfer in UI
            // and appears in both Income and Expense tables.
            return [outTx, inTx].map(tx => ({ ...tx, amount }));
          };

          if (isCashConversion) {
            const pair = makeCashConversionPair(data.date, tempId, Date.now());
            setTransactions(prev => [...prev, ...pair]);

            // Background Sync: create once (service creates both), then re-sync
            (async () => {
              try {
                await TransactionService.create({
                  ...data,
                  type: 'expense',
                  paymentType: 'online' as any,
                  accountName: '',
                  timestamp: Date.now(),
                  details: data.details?.trim() || 'ONLINE -> CASH'
                });
                const all = await TransactionService.getAll();
                setTransactions(all);
              } catch (e) {
                console.error("Create cash conversion failed", e);
                setTransactions(prev => prev.filter(t => t.id !== tempId && t.id !== tempId + 1));
              }
            })();
          } else {
            const ts = Date.now();
            const newTx: Transaction = {
                ...data,
                id: tempId,
                timestamp: ts
            };
            setTransactions(prev => [...prev, newTx]);

            // Persist locally immediately so refresh won't lose it.
            outboxAddMany([{ ...data, timestamp: ts }]);

            // Background Sync
            TransactionService.create({ ...data, timestamp: ts })
                .then(realTx => {
                    // Replace temp ID with real ID
                    setTransactions(prev => prev.map(t => t.id === tempId ? realTx : t));
                    outboxRemoveMany([{ ...data, timestamp: ts }]);
                })
                .catch(e => {
                    console.error("Create tx failed", e);
                    setTransactions(prev => prev.filter(t => t.id !== tempId));
                    alert(`Transaction not saved. Check internet/login and try again.\n\n${(e as any)?.message || ''}`.trim());
                });
          }
      }
      setEditingTransaction(null);
      // No need to call refreshAccounts() for balances, as they are derived from transactions state
  };

  const handleDeleteTransaction = async (id: number) => {
      if (!window.confirm(t.confirmDelete)) return;

      const tx = transactions.find(t => t.id === id);
      if (!tx) return;

      let idsToDelete: number[] = [id];

      // If this is an Online->Cash transfer, remove BOTH sides.
      // Also remove any older duplicates that may have different `details` strings.
      if (tx.category === 'cash_conversion') {
        const matching = transactions.filter(other => {
          if (other.category !== 'cash_conversion') return false;
          if (other.date !== tx.date) return false;
          if (other.amount !== tx.amount) return false;

          const isExpenseOnline = other.type === 'expense' && other.paymentType === 'online';
          const isIncomeCash = other.type === 'income' && other.paymentType === 'cash';
          return isExpenseOnline || isIncomeCash;
        });

        const uniqueIds = Array.from(new Set(matching.map(m => m.id)));
        if (uniqueIds.length) idsToDelete = uniqueIds;
      }

      const deleteSet = new Set(idsToDelete);
      setTransactions(prev => prev.filter(t => !deleteSet.has(t.id)));

      // Background
      try {
          await Promise.all(idsToDelete.map(txId => TransactionService.delete(txId)));
      } catch (e) {
          console.error("Delete tx failed", e);
          // Typically we'd reload data here if it failed
      }
  };
  
  const openTransactionModal = (mode: TransactionType, defaults?: { category?: string, accountName?: string }, editData?: Transaction) => {
      setModalMode(mode);
      setModalDefaults(defaults || {});
      setEditingTransaction(editData || null);
      setIsModalOpen(true);
  };

  // Shortcuts (Transactions tab only): F1 = Add Income, F2 = Add Expense
  useEffect(() => {
      const handler = (e: KeyboardEvent) => {
          if (activeTab !== 'transactions') return;
          if (isModalOpen) return;

          const target = e.target as HTMLElement | null;
          const tag = target?.tagName?.toLowerCase();
          const isTypingTarget =
              tag === 'input' ||
              tag === 'textarea' ||
              (target as any)?.isContentEditable;
          if (isTypingTarget) return;

          // Prevent browser help (F1) and default function key behaviors
          if (e.key === 'F1') {
              e.preventDefault();
              openTransactionModal('income');
          } else if (e.key === 'F2') {
              e.preventDefault();
              openTransactionModal('expense');
          }
      };

      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
  }, [activeTab, isModalOpen]);

  // Opening Balance Modal Handlers
  const openBalanceModal = () => {
      setTempOpeningBalance({
          cash: formatInputCurrency(initialOpeningBalance.cash.toString()),
          online: formatInputCurrency(initialOpeningBalance.online.toString())
      });
      setIsBalanceModalOpen(true);
  };

  const saveOpeningBalance = async () => {
      const newVal = {
          cash: parseCurrency(tempOpeningBalance.cash) || 0,
          online: parseCurrency(tempOpeningBalance.online) || 0
      };
      // Optimistic
      setInitialOpeningBalance(newVal);
      setIsBalanceModalOpen(false);
      
      // Sync
      SettingsService.set('openingBalanceData', newVal);
  };

  // Enter key should save the Opening Balance modal reliably.
  useEffect(() => {
      if (!isBalanceModalOpen) return;
      openingBalanceSubmittingRef.current = false;

      const onKeyDown = (e: KeyboardEvent) => {
          if (e.key !== 'Enter') return;
          if (e.repeat) return;
          if (openingBalanceSubmittingRef.current) return;

          const target = e.target as HTMLElement | null;
          const tag = target?.tagName?.toLowerCase();
          if (tag === 'textarea' || tag === 'select') return;
          if ((target as any)?.isContentEditable) return;

          e.preventDefault();
          openingBalanceFormRef.current?.requestSubmit();
      };

      window.addEventListener('keydown', onKeyDown, { capture: true });
      return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isBalanceModalOpen]);

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
  // Updated signature to accept null for delete
  const handleToggleAttendance = async (accountName: string, date: string, isPresent: boolean | null) => {
     const canonicalAccount = accountName.trim().toLowerCase();
     const key = `${canonicalAccount}__${date}`;
     const nextSeq = (attendanceWriteSeqRef.current[key] || 0) + 1;
     attendanceWriteSeqRef.current[key] = nextSeq;

     // Optimistic Update
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.name.trim().toLowerCase() === canonicalAccount) {
             const newAttendance = { ...acc.attendance };
             if (isPresent === null || isPresent === undefined) {
                 delete newAttendance[date];
             } else {
                 newAttendance[date] = isPresent;
             }
             return { ...acc, attendance: newAttendance };
         }
         return acc;
     }));

     // Sync
     try {
         await AccountService.toggleAttendance(accountName.trim(), date, isPresent);
     } catch (e) {
         console.error('Attendance sync failed', e);
     } finally {
         // If a newer intent exists, let it continue; otherwise clear to avoid unbounded growth.
         if (attendanceWriteSeqRef.current[key] === nextSeq) {
             delete attendanceWriteSeqRef.current[key];
         }
     }
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

  const handleAddOwnerPreviousEntry = async (
      accountName: string,
      entry: Omit<OwnerPreviousEntry, 'id'>
  ) => {
      const tempId = Date.now();
      const temp: OwnerPreviousEntry = { ...entry, id: tempId };

      setAccounts(prevAccounts =>
          prevAccounts.map(acc =>
              acc.name === accountName && acc.type === 'partner'
                  ? { ...acc, ownerPreviousEntries: [...(acc.ownerPreviousEntries || []), temp] }
                  : acc
          )
      );

      try {
          const saved = await AccountService.addOwnerPreviousEntry(accountName, entry);
          setAccounts(prevAccounts => {
              const next = prevAccounts.map(acc =>
                  acc.name === accountName && acc.type === 'partner'
                      ? {
                            ...acc,
                            ownerPreviousEntries: acc.ownerPreviousEntries?.map(e =>
                                e.id === tempId ? saved : e
                            )
                        }
                      : acc
              );
              const p = next.find(a => a.name === accountName && a.type === 'partner');
              persistOwnerPreviousForAccount(accountName, p?.ownerPreviousEntries || []);
              return next;
          });
      } catch (e) {
          console.error('Add owner previous entry failed', e);
          const localId = -Math.abs(Date.now());
          setAccounts(prevAccounts => {
              const next = prevAccounts.map(acc =>
                  acc.name === accountName && acc.type === 'partner'
                      ? {
                            ...acc,
                            ownerPreviousEntries: acc.ownerPreviousEntries?.map(en =>
                                en.id === tempId ? { ...en, id: localId } : en
                            )
                        }
                      : acc
              );
              const p = next.find(a => a.name === accountName && a.type === 'partner');
              persistOwnerPreviousForAccount(accountName, p?.ownerPreviousEntries || []);
              return next;
          });
      }
  };

  const handleUpdateOwnerPreviousEntry = async (accountName: string, entry: OwnerPreviousEntry) => {
      setAccounts(prevAccounts => {
          const next = prevAccounts.map(acc =>
              acc.name === accountName && acc.type === 'partner'
                  ? {
                        ...acc,
                        ownerPreviousEntries: acc.ownerPreviousEntries?.map(e =>
                            e.id === entry.id ? entry : e
                        )
                    }
                  : acc
          );
          const p = next.find(a => a.name === accountName && a.type === 'partner');
          persistOwnerPreviousForAccount(accountName, p?.ownerPreviousEntries || []);
          return next;
      });

      if (entry.id < 0) return;

      try {
          await AccountService.updateOwnerPreviousEntry(entry);
      } catch (e) {
          console.error('Update owner previous entry failed', e);
      }
  };

  const handleDeleteOwnerPreviousEntry = async (accountName: string, id: number) => {
      setAccounts(prevAccounts => {
          const next = prevAccounts.map(acc =>
              acc.name === accountName && acc.type === 'partner'
                  ? {
                        ...acc,
                        ownerPreviousEntries: acc.ownerPreviousEntries?.filter(e => e.id !== id)
                    }
                  : acc
          );
          const p = next.find(a => a.name === accountName && a.type === 'partner');
          persistOwnerPreviousForAccount(accountName, p?.ownerPreviousEntries || []);
          return next;
      });

      if (id < 0) return;

      try {
          await AccountService.deleteOwnerPreviousEntry(id);
      } catch (e) {
          console.error('Delete owner previous entry failed', e);
      }
  };

  // Save Translation Cache
  useEffect(() => {
     if (Object.keys(translationCache.hi).length > 0 || Object.keys(translationCache.pa).length > 0) {
        SettingsService.set('translationCache', translationCache);
     }
  }, [translationCache]);

  // --- Translation Logic ---
  const getTranslated = React.useCallback((text?: string): string => {
    if (!text) return "";
    if (language === 'en') return text;
    const cache = translationCache[language];
    return cache && cache[text] ? cache[text] : text;
  }, [language, translationCache]);

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
      // Keep Income/Expense tables in entry order (newest entered first),
      // independent of selected transaction date.
      return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
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

  // Total Income/Expense for the Cashbook tables (sum of visible transactions)
  const totalIncome = currentViewStats.cashIn + currentViewStats.onlineIn;

  const totalExpense = currentViewStats.cashOut + currentViewStats.onlineOut;
  
  // Final Balances: Previous + Current Change
  // NOTE: Final Balance keeps using currentViewStats (Actual Transactions) to ensure Cashbook integrity
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
    
    return { expense, labour, oil, electricity, partnerIn };
  }, [transactions, statsStartDate, statsEndDate]);

  // Helpers
  const getCategoryLabel = (cat: string) => {
      if (cat === 'customer') return t.customerOption;
      if (cat === 'partner') return t.partnerOption;
      if (cat === 'shop') return t.shopOption;
      if (cat === 'labour') return t.labourOption;
      if (cat === 'oil') return t.oilOption;
      if (cat === 'cl_oil') return t.clOilOption;
      if (cat === 'electricity') return t.electricityOption;
      if (cat === 'food') return t.foodOption;
      if (cat === 'supplier') return t.supplierOption;

      if (cat === 'cash_conversion') return "ONLINE -> CASH";
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
          <header className="bg-white shadow-sm z-10">
              <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-center gap-8">
                  {/* Left: Language icon + selector (fixed area) */}
                  <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center"
                        title={t.langLabel}
                        aria-label={t.langLabel}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.6 2.3 4.2 5.4 4.2 9s-1.6 6.7-4.2 9c-2.6-2.3-4.2-5.4-4.2-9S9.4 5.3 12 3Z" />
                        </svg>
                      </div>
                      <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value as Language)}
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all"
                          aria-label={t.langLabel}
                      >
                          <option value="en">English</option>
                          <option value="hi">हिंदी</option>
                          <option value="pa">ਪੰਜਾਬੀ</option>
                      </select>

                      <button
                         onClick={handleTranslateData}
                         disabled={isTranslating || language === 'en'}
                         className={`px-3 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all ${
                           language === 'en'
                             ? 'opacity-0 pointer-events-none select-none'
                             : (isTranslating ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-700 hover:bg-blue-100')
                         }`}
                         title="Translate all names and notes using AI"
                         aria-hidden={language === 'en'}
                         tabIndex={language === 'en' ? -1 : 0}
                      >
                         {isTranslating ? (
                             <>
                               <svg className="animate-spin h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                  </div>

                  {/* User profile */}
                  <UserProfileHeader />
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
          <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 overflow-hidden flex flex-col">
              <div className="flex-1 lg:bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-200 lg:p-6">
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

                            <h2 className="text-2xl font-bold mb-4 pr-10 text-center">{t.prevBalTitle}</h2>
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

                      {/* EXPENSE TRANSACTIONS TABLE */}
                      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                          <div className="flex justify-between items-center mb-4">
                              <h2 className="text-lg sm:text-xl font-extrabold tracking-wide uppercase text-red-700">
                                {t.expenseTitle}
                              </h2>
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
                                              <td className="px-4 py-3 text-center">
                                                  <span className="inline-flex justify-center px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
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

                      {/* INCOME TRANSACTIONS TABLE */}
                      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                          <div className="flex justify-between items-center mb-4">
                              <h2 className="text-lg sm:text-xl font-extrabold tracking-wide uppercase text-green-700">
                                {t.incomeTitle}
                              </h2>
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
                                              <td className="px-4 py-3 text-center">
                                                  <span className="inline-flex justify-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
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

                      {/* FINAL BALANCE CARD */}
                      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg shadow-md p-6 text-white text-center md:text-left">
                          <h2 className="text-2xl font-bold mb-4 text-center">{t.finalBalanceTitle}</h2>
                          
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
                          <h2 className="text-lg sm:text-xl font-extrabold tracking-wide uppercase text-indigo-900 mb-6">
                            {t.statsTitle}
                          </h2>
                          
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

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                              {/* Thread Expense */}
                              <div className="p-5 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                                      <p className="text-xs uppercase tracking-wide font-bold text-blue-600 mb-1">{t.statsElectricityExpense}</p>
                                      <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(stats.electricity)}</p>
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
                      hiddenLedgerAccountNames={hiddenLedgerAccounts}
                      removedAccounts={removedLedgerAccounts}
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
                      onRenameAccount={handleRenameAccount}
                      onDeleteAccount={handleDeleteAccount}
                      onRestoreAccount={handleRestoreLedgerAccount}
                      onDeleteRemovedAccount={handleDeleteRemovedLedgerAccount}
                      onAddOwnerPreviousEntry={handleAddOwnerPreviousEntry}
                      onUpdateOwnerPreviousEntry={handleUpdateOwnerPreviousEntry}
                      onDeleteOwnerPreviousEntry={handleDeleteOwnerPreviousEntry}
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
                      stockMovements={stockMovements}
                      t={t}
                      language={language}
                      getTranslated={getTranslated}
                  />
              )}
              </div>
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
                  <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl animate-fade-in relative">
                      <button
                        type="button"
                        onClick={() => setIsBalanceModalOpen(false)}
                        className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition"
                        aria-label={t.cancelBtn}
                        title={t.cancelBtn}
                      >
                        ✕
                      </button>
                      <h3 className="text-xl font-bold mb-4">{t.editOpeningBalanceTitle}</h3>
                      <form
                        ref={openingBalanceFormRef}
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (openingBalanceSubmittingRef.current) return;
                          openingBalanceSubmittingRef.current = true;
                          void saveOpeningBalance();
                        }}
                      >
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.initialCashLabel}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={tempOpeningBalance.cash}
                                onChange={(e) =>
                                  setTempOpeningBalance(prev => ({ ...prev, cash: formatInputCurrency(e.target.value) }))
                                }
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.initialOnlineLabel}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={tempOpeningBalance.online}
                                onChange={(e) =>
                                  setTempOpeningBalance(prev => ({ ...prev, online: formatInputCurrency(e.target.value) }))
                                }
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition"
                        >
                            {t.saveBtn}
                        </button>
                      </form>
                  </div>
              </div>
          )}
      </div>
  );
};

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
