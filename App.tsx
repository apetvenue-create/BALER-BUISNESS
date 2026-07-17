
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
  OwnerPreviousEntry,
  FarmerProfileDetails
} from './types';
import { TRANSLATIONS } from './constants';
import { getDatesInRange, formatIndianCurrency, formatDisplayDate, formatISODateLocal, formatInputCurrency, parseCurrency, normalizeAccountName } from './utils';
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
import { BusinessNotes, BusinessNote } from './components/BusinessNotes';
import { ConfirmProvider, useConfirm } from './components/ConfirmDialog';
import { EscapeStackProvider, useEscapeLayer, ESCAPE_PRIORITY } from './components/EscapeStack';
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
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  useEscapeLayer(
    'logout-confirm',
    () => setIsLogoutConfirmOpen(false),
    isLogoutConfirmOpen,
    ESCAPE_PRIORITY.confirm
  );
  
  if (!session) return null;

  const accountName = session.name?.trim() || session.email.split('@')[0] || session.email;
  const initial = accountName.charAt(0).toUpperCase();

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div
          className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 sm:px-3"
          title={session.email}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
            {initial}
          </span>
          <span className="max-w-24 truncate text-xs font-bold text-slate-700 sm:max-w-40 sm:text-sm">
            {accountName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsLogoutConfirmOpen(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-2.5 py-2 text-xs font-bold text-red-600 transition hover:border-red-200 hover:bg-red-100 sm:px-3 sm:text-sm"
          title="Logout"
          aria-label="Logout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>

      {isLogoutConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLogoutConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              </span>
              <div>
                <h2 id="logout-confirm-title" className="text-base font-bold text-slate-900 sm:text-lg">
                  Confirm logout
                </h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">
                  Are you sure you want to log out of {accountName}?
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
              >
                Yes, logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// --- MAIN FINANCIAL APP (WRAPPED CONTENT) ---
const FinancialApp: React.FC = () => {
  const { session } = useAuth();
  const confirm = useConfirm();
  const currentUserId = session?.userId || 'unauthenticated';

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
  const mainContentRef = useRef<HTMLElement>(null);
  const skipInitialTabScrollRef = useRef(true);

  // Keep every page scrollable while hiding the browser's side scrollbar.
  useEffect(() => {
    document.documentElement.classList.add('hide-page-scrollbar');
    document.body.classList.add('hide-page-scrollbar');
    return () => {
      document.documentElement.classList.remove('hide-page-scrollbar');
      document.body.classList.remove('hide-page-scrollbar');
    };
  }, []);

  // After switching tabs, jump to the page content so header/nav sit above the screen.
  // Scroll up anytime to reveal them again.
  useEffect(() => {
    if (skipInitialTabScrollRef.current) {
      skipInitialTabScrollRef.current = false;
      return;
    }

    const el = mainContentRef.current;
    if (!el) return;

    const scrollToPageStart = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(scrollToPageStart);
    });
    const timeoutId = window.setTimeout(scrollToPageStart, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [activeTab]);
  
  // Translation State
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
      mode: 'single',
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
  const notesSectionRef = useRef<HTMLDivElement>(null);
  const previousBalanceRef = useRef<HTMLDivElement>(null);
  const expenseTransactionsRef = useRef<HTMLDivElement>(null);
  const incomeTransactionsRef = useRef<HTMLDivElement>(null);
  const finalBalanceRef = useRef<HTMLDivElement>(null);
  const summaryReportRef = useRef<HTMLDivElement>(null);
  const [floatingDownStep, setFloatingDownStep] = useState(0);
  const [floatingUpStep, setFloatingUpStep] = useState(0);
  const [statsStartDate, setStatsStartDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [statsEndDate, setStatsEndDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  );

  useEffect(() => {
    if (activeTab === 'transactions') {
      setFloatingDownStep(0);
      setFloatingUpStep(0);
    }
  }, [activeTab]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TransactionType>('income');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalDefaults, setModalDefaults] = useState<{ category?: string, accountName?: string }>({});

  const [isLoading, setIsLoading] = useState(true);
  const [businessNotes, setBusinessNotes] = useState<BusinessNote[]>([]);

  // ---- Local outbox for transactions (prevents “disappears after refresh”) ----
  // If Supabase insert fails / is pending and the user refreshes, we keep the tx locally
  // and auto-sync it on next load.
  const TX_OUTBOX_KEY = `pendingTransactions_v1:${currentUserId}`;
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
            persistOwnerPreviousForAccount(currentUserId, acc.name, p?.ownerPreviousEntries || []);
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
          const [obResult, transCacheResult, hiddenLedgerResult, removedLedgerResult, notesResult] = await Promise.allSettled([
              SettingsService.get('openingBalanceData'),
              SettingsService.get('translationCache'),
              SettingsService.get('hiddenLedgerAccounts'),
              SettingsService.get('removedLedgerAccounts'),
              SettingsService.get('businessNotes'),
          ]);

          const txs = txsResult.status === 'fulfilled' ? txsResult.value : [];
          const accs = accsResult.status === 'fulfilled' ? accsResult.value : [];
          const stocks = stocksResult.status === 'fulfilled' ? stocksResult.value : [];
          const ob = obResult.status === 'fulfilled' ? obResult.value : null;
          const transCache = transCacheResult.status === 'fulfilled' ? transCacheResult.value : null;
          const hiddenLedger = hiddenLedgerResult.status === 'fulfilled' ? hiddenLedgerResult.value : [];
          const removedLedger = removedLedgerResult.status === 'fulfilled' ? removedLedgerResult.value : [];
          const savedNotes = notesResult.status === 'fulfilled' ? notesResult.value : [];

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
          setBusinessNotes(Array.isArray(savedNotes) ? savedNotes : []);
          const localOwnerPrev = loadOwnerPreviousLocal(currentUserId);
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

  const handleBusinessNotesChange = async (notes: BusinessNote[]) => {
      const previousNotes = businessNotes;
      // Instant UI + localStorage; remote sync in background
      setBusinessNotes(notes);
      void SettingsService.set('businessNotes', notes, { throwOnError: true }).catch(error => {
          console.error('Notes sync failed', error);
          setBusinessNotes(previousNotes);
          alert('Note could not sync. Check your connection and try again.');
      });
  };

  // --- Persistence Handlers (Optimistic) ---

  const handleCreateAccount = async (
      name: string,
      type: AccountType,
      rate?: number,
      details?: FarmerProfileDetails
  ) => {
      const accountName = normalizeAccountName(name);
      if (!accountName) return;

      // Optimistic Check & Update
      if (accounts.some(a => a.name.toLowerCase() === accountName.toLowerCase())) return;

      const nextHiddenCreate = hiddenLedgerAccounts.filter(
          n => n.toLowerCase() !== accountName.toLowerCase()
      );
      if (nextHiddenCreate.length < hiddenLedgerAccounts.length) {
          setHiddenLedgerAccounts(nextHiddenCreate);
          void SettingsService.set('hiddenLedgerAccounts', nextHiddenCreate);
      }

      const safeType: AccountType = ['labour', 'partner', 'customer', 'supplier', 'other'].includes(type) ? type : 'other';
      
      const newAccount: StoredAccount = {
          name: accountName,
          type: safeType,
          rate,
          attendance: {},
          hisaabDays: {},
          manualAdjustments: [],
          ...(safeType === 'partner' ? { ownerPreviousEntries: [] as OwnerPreviousEntry[] } : {}),
          ...(safeType === 'supplier' && details
            ? {
                phone: details.phone,
                address: details.address,
                acres: details.acres,
                dateCutter: details.dateCutter,
              }
            : {}),
          ...(safeType === 'labour' && details
            ? { phone: details.phone?.replace(/\D/g, '').slice(0, 10) || undefined }
            : {}),
          ...(safeType === 'customer' && details
            ? { phone: details.phone?.replace(/\D/g, '').slice(0, 10) || undefined }
            : {})
      };

      // Update State Immediately — never block the UI on network
      setAccounts(prev => [...prev, newAccount]);

      void AccountService.create(accountName, safeType, rate, details).catch(e => {
          console.error("Create account failed", e);
          setAccounts(prev => prev.filter(a => a.name !== accountName));
          alert("Failed to create account on server.");
      });
  };

  const handleRenameAccount = async (oldName: string, newName: string) => {
      const canonicalOld = oldName.trim();
      const canonicalNew = normalizeAccountName(newName);
      if (!canonicalNew) return;
      // Allow capitalization-only changes (e.g. "ram" → "RAM"); skip only if identical
      if (canonicalOld === canonicalNew) return;

      // Conflict only if a *different* account already uses this name (ignore case)
      const conflict = accounts.some(a => {
          const n = a.name.trim();
          if (n === canonicalOld) return false;
          return n.toLowerCase() === canonicalNew.toLowerCase();
      });
      if (conflict) {
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
          renameOwnerPreviousLocalKey(currentUserId, canonicalOld, canonicalNew);
      } catch (e) {
          console.error("Rename failed", e);
          alert("Failed to update name on server. Please refresh.");
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

  const handleUpdateAccount = async (updated: StoredAccount, previousName?: string) => {
      const matchName = (previousName || updated.name).trim().toLowerCase();
      const prev = accounts.find(a => a.name.trim().toLowerCase() === matchName);
      setAccounts(list =>
        list.map(a =>
          a.name.trim().toLowerCase() === matchName
            ? { ...a, ...updated, name: updated.name }
            : a
        )
      );

      if (updated.type === 'supplier') {
          try {
              await AccountService.updateFarmerDetails(updated.name, {
                  phone: updated.phone,
                  address: updated.address,
                  acres: updated.acres,
                  dateCutter: updated.dateCutter,
              });
          } catch (e) {
              console.error('Update farmer details failed', e);
              if (prev) setAccounts(list => list.map(a => (a.name === prev.name ? prev : a)));
              alert('Failed to save farmer details.');
          }
      }

      if (updated.type === 'labour') {
          try {
              await AccountService.updateLabourDetails(updated.name, {
                  rate: updated.rate,
                  phone: updated.phone,
              });
          } catch (e) {
              console.error('Update labour details failed', e);
              if (prev) {
                setAccounts(list =>
                  list.map(a =>
                    a.name.trim().toLowerCase() === updated.name.trim().toLowerCase() ||
                    a.name.trim().toLowerCase() === matchName
                      ? { ...prev, name: updated.name, phone: updated.phone ?? prev.phone, rate: updated.rate ?? prev.rate }
                      : a
                  )
                );
              }
              alert('Failed to save labour details.');
          }
      }

      if (updated.type === 'customer') {
          try {
              await AccountService.updateCustomerDetails(updated.name, updated.phone);
          } catch (e) {
              console.error('Update customer details failed', e);
              if (prev) setAccounts(list => list.map(a => (a.name === prev.name ? prev : a)));
              alert('Failed to save customer details.');
          }
      }
  };

  const handleAddTransaction = async (rawData: Omit<Transaction, 'id' | 'timestamp'>) => {
      const data = {
        ...rawData,
        accountName: rawData.accountName ? normalizeAccountName(rawData.accountName) : rawData.accountName,
        amount: Math.round(Number(rawData.amount) || 0),
      };

      // 1. Create Account if needed — fire-and-forget so the row appears in the same tick
      if (data.accountName) {
         const exists = accounts.some(a => a.name.toLowerCase() === data.accountName!.toLowerCase());
         if (!exists) {
             void handleCreateAccount(data.accountName, data.category as AccountType);
         }
      }

      // --- AUTO-ADJUST DATE FILTER (CASHBOOK RULE) ---
      const txDate = data.date;
      const isInsideActiveRange =
          dateFilter.mode === 'all' ||
          (dateFilter.mode === 'single' && txDate === dateFilter.singleDate) ||
          (dateFilter.mode === 'range' &&
            txDate >= dateFilter.fromDate &&
            txDate <= dateFilter.toDate);

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

            // 2) Background sync: delete old representation, create new — no full refetch
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
                  const saved = await TransactionService.create({
                    ...updatedTx,
                    type: 'expense',
                    category: 'cash_conversion',
                    accountName: '',
                    paymentType: 'online' as any,
                    timestamp: Date.now(),
                    details: (updatedTx.details || '').trim() || 'ONLINE -> CASH'
                  }) as Transaction & { pairedIncomeId?: number };
                  const incomeId = saved.pairedIncomeId;
                  setTransactions(prev =>
                    prev.map(t => {
                      if (t.category !== 'cash_conversion') return t;
                      if (t.type === 'expense' && t.date === updatedTx.date && t.amount === updatedTx.amount && t.id > 1e12) {
                        return { ...t, id: saved.id, details: saved.details || t.details };
                      }
                      if (t.type === 'income' && t.date === updatedTx.date && t.amount === updatedTx.amount && t.id > 1e12 && incomeId) {
                        return { ...t, id: incomeId, details: saved.details || t.details };
                      }
                      return t;
                    })
                  );
                } else {
                  const saved = await TransactionService.create({
                    ...updatedTx,
                    timestamp: Date.now()
                  });
                  setTransactions(prev =>
                    prev.map(t => (t.id === prevTx.id ? { ...saved } : t))
                  );
                }
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
              setTransactions(prev => prev.map(t => t.id === prevTx.id ? prevTx : t));
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
              details: data.details?.trim() || 'ONLINE -> CASH',
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

            // Background Sync: create once (service creates both), patch IDs — no full refetch
            (async () => {
              try {
                const saved = await TransactionService.create({
                  ...data,
                  type: 'expense',
                  paymentType: 'online' as any,
                  accountName: '',
                  timestamp: Date.now(),
                  details: data.details?.trim() || 'ONLINE -> CASH'
                }) as Transaction & { pairedIncomeId?: number };
                const incomeId = saved.pairedIncomeId;
                setTransactions(prev =>
                  prev.map(t => {
                    if (t.id === tempId) {
                      return { ...t, id: saved.id, details: saved.details || t.details };
                    }
                    if (t.id === tempId + 1 && incomeId) {
                      return { ...t, id: incomeId, details: saved.details || t.details };
                    }
                    return t;
                  })
                );
              } catch (e) {
                console.error("Create cash conversion failed", e);
                setTransactions(prev => prev.filter(t => t.id !== tempId && t.id !== tempId + 1));
                alert(`Transfer not saved. Check internet/login and try again.\n\n${(e as any)?.message || ''}`.trim());
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
      const ok = await confirm({
        title: t.deleteBtn,
        message: t.confirmDelete,
        confirmLabel: t.deleteBtn,
        cancelLabel: t.cancelBtn,
      });
      if (!ok) return;

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

  // Net of income/expense before the current filter start date (excludes stored opening balance).
  const getPriorTxNets = () => {
      if (dateFilter.mode === 'all') return { cash: 0, online: 0 };
      const startDate = dateFilter.mode === 'single' ? dateFilter.singleDate : dateFilter.fromDate;
      let cash = 0;
      let online = 0;
      for (const t of transactions) {
          if (t.date >= startDate) continue;
          if (t.type === 'income') {
              if (t.paymentType === 'cash') cash += t.amount;
              else online += t.amount;
          } else {
              if (t.paymentType === 'cash') cash -= t.amount;
              else online -= t.amount;
          }
      }
      return { cash, online };
  };

  // Edit the amounts shown on the Previous Balance card (opening + prior txs).
  const openBalanceModal = (e?: React.MouseEvent | React.PointerEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      openingBalanceSubmittingRef.current = false;
      const prior = getPriorTxNets();
      const displayCash = (initialOpeningBalance.cash || 0) + prior.cash;
      const displayOnline = (initialOpeningBalance.online || 0) + prior.online;
      setTempOpeningBalance({
          cash: formatInputCurrency(String(displayCash)),
          online: formatInputCurrency(String(displayOnline))
      });
      setIsBalanceModalOpen(true);
  };

  const saveOpeningBalance = async () => {
      try {
          const prior = getPriorTxNets();
          // Back out prior txs so stored value stays the true opening balance.
          const newVal = {
              cash: (parseCurrency(tempOpeningBalance.cash) || 0) - prior.cash,
              online: (parseCurrency(tempOpeningBalance.online) || 0) - prior.online
          };
          setInitialOpeningBalance(newVal);
          setIsBalanceModalOpen(false);
          await SettingsService.set('openingBalanceData', newVal);
      } catch (error) {
          console.error('Save opening balance failed', error);
          alert('Failed to save opening balance. Please try again.');
      } finally {
          openingBalanceSubmittingRef.current = false;
      }
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

  useEscapeLayer(
    'opening-balance-modal',
    () => {
      openingBalanceSubmittingRef.current = false;
      setIsBalanceModalOpen(false);
    },
    isBalanceModalOpen,
    ESCAPE_PRIORITY.modal
  );

  // ESC from Accounts / Stock / Reports returns to home (Transactions + navigation).
  useEscapeLayer(
    'tab-home',
    () => {
      setActiveTab('transactions');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    activeTab !== 'transactions',
    ESCAPE_PRIORITY.home
  );

  // Stock Handlers (Optimistic)
  const handleAddStockMovement = async (m: StockMovement) => {
      // Optimistic — show in history immediately
      setStockMovements(prev => [...prev, m]);
      
      // Sync
      try {
          const saved = await StockService.create(m);
          // Replace with real ID
          setStockMovements(prev => prev.map(item => item.id === m.id ? saved : item));
      } catch (e) {
          console.error("Add stock failed", e);
          setStockMovements(prev => prev.filter(item => item.id !== m.id));
          alert("Failed to save stock movement. Please try again.");
      }
  };

  const handleUpdateStockMovement = async (m: StockMovement) => {
      // Optimistic
      setStockMovements(prev => prev.map(item => item.id === m.id ? m : item));
      
      // Sync
      StockService.update(m).catch(e => console.error("Update stock failed", e));
  };

  const handleDeleteStockMovement = async (id: number) => {
      const ok = await confirm({
        title: t.deleteBtn,
        message: t.confirmDelete,
        confirmLabel: t.deleteBtn,
        cancelLabel: t.cancelBtn,
      });
      if (!ok) return;
      // Optimistic
      setStockMovements(prev => prev.filter(item => item.id !== id));
      // Sync
      StockService.delete(id).catch(e => console.error("Delete stock failed", e));
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
     const previousAccounts = accounts;
     setAccounts(prevAccounts => prevAccounts.map(acc => {
         if (acc.manualAdjustments?.some(a => a.id === adj.id)) {
             return {
                 ...acc,
                 manualAdjustments: acc.manualAdjustments.map(a => a.id === adj.id ? adj : a)
             };
         }
         return acc;
     }));

     try {
         await AccountService.updateAdjustment(adj);
     } catch (error) {
         console.error('Update previous balance failed', error);
         setAccounts(previousAccounts);
         alert('Failed to update previous balance.');
     }
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
              persistOwnerPreviousForAccount(currentUserId, accountName, p?.ownerPreviousEntries || []);
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
              persistOwnerPreviousForAccount(currentUserId, accountName, p?.ownerPreviousEntries || []);
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
          persistOwnerPreviousForAccount(currentUserId, accountName, p?.ownerPreviousEntries || []);
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
          persistOwnerPreviousForAccount(currentUserId, accountName, p?.ownerPreviousEntries || []);
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
    if (!cache) return text;
    if (cache[text]) return cache[text];

    // Preserve translations created before account names were normalized to uppercase.
    const matchingKey = Object.keys(cache).find(
      key => key.trim().toLocaleLowerCase() === text.trim().toLocaleLowerCase()
    );
    return matchingKey ? cache[matchingKey] : text;
  }, [language, translationCache]);

  const handleTranslateData = async () => {
      if (language === 'en') return;
      
      const textsToTranslate = new Set<string>();
      
      // Accounts
      accounts.forEach(a => {
          textsToTranslate.add(a.name);
          if (a.address) textsToTranslate.add(a.address);
          a.manualAdjustments?.forEach(adj => {
              if (adj.note) textsToTranslate.add(adj.note);
          });
          a.ownerPreviousEntries?.forEach(entry => {
              if (entry.note) textsToTranslate.add(entry.note);
          });
      });
      
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

      // Business notes
      businessNotes.forEach(note => {
          if (note.title) textsToTranslate.add(note.title);
          if (note.body) textsToTranslate.add(note.body);
      });

      // Filter out already translated
      const currentCache = translationCache[language] || {};
      const pendingTexts = Array.from(textsToTranslate).filter(t => !currentCache[t]);

      if (pendingTexts.length === 0) return;

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
      }
  };

  // Automatically translate user-entered data whenever Hindi/Punjabi is selected
  // or new account/transaction/stock/note data arrives.
  useEffect(() => {
      if (language === 'en') return;
      void handleTranslateData();
      // translationCache is intentionally excluded: updating translations must not
      // start another request for the same data.
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, accounts, transactions, stockMovements, businessNotes]);

  // --- Logic: Calculations ---

  const displayedTransactions = useMemo(() => {
      let filtered = transactions;
      if (dateFilter.mode === 'single') {
          filtered = filtered.filter(t => t.date === dateFilter.singleDate);
      } else if (dateFilter.mode === 'range') {
          filtered = filtered.filter(t => t.date >= dateFilter.fromDate && t.date <= dateFilter.toDate);
      }
      // Keep Income/Expense tables in entry order (newest entered first),
      // independent of selected transaction date.
      return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, dateFilter]);

  const expenseTransactions = useMemo(
    () => displayedTransactions.filter(tr => tr.type === 'expense'),
    [displayedTransactions]
  );
  const incomeTransactions = useMemo(
    () => displayedTransactions.filter(tr => tr.type === 'income'),
    [displayedTransactions]
  );

  // Previous Balance: Initial + (Income - Expense) before start date
  const previousBalance = useMemo(() => {
      if (dateFilter.mode === 'all') {
          const cash = initialOpeningBalance.cash;
          const online = initialOpeningBalance.online;
          return { cash, online, total: cash + online };
      }
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
    let machineRepair = 0;
    let newMachinery = 0;
    let otherRepair = 0;
    
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
                if (t.category === 'machine_repair') {
                    machineRepair += t.amount;
                }
                if (t.category === 'new_machinery') {
                    newMachinery += t.amount;
                }
                if (t.category === 'other_repair') {
                    otherRepair += t.amount;
                }
            } else if (t.type === 'income' && t.category === 'partner') {
                partnerIn += t.amount;
            }
        }
    });
    
    return { expense, labour, oil, electricity, machineRepair, newMachinery, otherRepair, partnerIn };
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
      if (cat === 'machine_repair') return t.machineRepairOption;
      if (cat === 'new_machinery') return t.newMachineryOption;
      if (cat === 'other_repair') return t.otherRepairOption;
      if (cat === 'custom') return t.customOption;
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
              <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-center gap-4 sm:gap-8">
                  {/* Left: Language icon + selector (fixed area) */}
                  <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center"
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
                          className="border border-gray-200 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-all"
                          aria-label={t.langLabel}
                      >
                          <option value="en">English</option>
                          <option value="hi">हिंदी</option>
                          <option value="pa">ਪੰਜਾਬੀ</option>
                      </select>
                  </div>

                  {/* User profile */}
                  <UserProfileHeader />
              </div>
              <div ref={notesSectionRef} className="scroll-mt-2">
                <BusinessNotes notes={businessNotes} onChange={handleBusinessNotesChange} />
              </div>
              {/* Tabs */}
              <div className="relative z-20 bg-slate-50 border-t border-slate-200 px-3 py-3">
                  <div className="tab-strip grid grid-cols-2 gap-2">
                      {([
                          { id: 'transactions' as const, label: t.tabTransactions },
                          { id: 'accounts' as const, label: t.tabAccounts },
                          { id: 'stock' as const, label: t.tabStock },
                          { id: 'reports' as const, label: t.tabReports },
                      ]).map(tab => {
                          const isActive = activeTab === tab.id;
                          return (
                              <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => setActiveTab(tab.id)}
                                  className={`relative z-20 flex w-full min-w-0 items-center justify-center border text-center py-4 px-3 rounded-xl text-sm font-bold leading-snug transition-all duration-150 touch-manipulation ${
                                      isActive
                                          ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                                          : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-blue-200 hover:text-blue-700 hover:shadow-md'
                                  }`}
                              >
                                  <span className="truncate">{tab.label}</span>
                              </button>
                          );
                      })}
                  </div>
              </div>
          </header>

          {/* Main Content */}
          <main
            ref={mainContentRef}
            className="flex-1 max-w-7xl mx-auto w-full p-2 sm:p-4 md:p-6 min-h-[100dvh] flex flex-col scroll-mt-0"
          >
              <div className="flex-1 flex flex-col lg:bg-white lg:rounded-2xl lg:shadow-sm lg:border lg:border-gray-200 lg:p-6">
              {activeTab === 'transactions' && (
                  <div className="flex flex-col space-y-3 sm:space-y-6">
                      <button
                        type="button"
                        onClick={() => {
                          const destinations = [
                            previousBalanceRef,
                            expenseTransactionsRef,
                            incomeTransactionsRef,
                            finalBalanceRef,
                            summaryReportRef,
                          ];
                          destinations[floatingDownStep].current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                          if (floatingDownStep === destinations.length - 1) {
                            setFloatingUpStep(0);
                          }
                          setFloatingDownStep(step => Math.min(step + 1, destinations.length - 1));
                        }}
                        className="fixed bottom-5 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-indigo-400/40 bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl active:translate-y-0 sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
                        title={`Go down to ${['Previous Balance', 'Expense Transactions', 'Income Transactions', 'Final Balance', 'Summary Report'][floatingDownStep]}`}
                        aria-label={`Go down to ${['Previous Balance', 'Expense Transactions', 'Income Transactions', 'Final Balance', 'Summary Report'][floatingDownStep]}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0 6-6m-6 6-6-6" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const destinations = [
                            finalBalanceRef,
                            incomeTransactionsRef,
                            expenseTransactionsRef,
                            previousBalanceRef,
                            notesSectionRef,
                          ];
                          destinations[floatingUpStep].current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                          if (floatingUpStep === destinations.length - 1) {
                            setFloatingDownStep(0);
                          }
                          setFloatingUpStep(step => Math.min(step + 1, destinations.length - 1));
                        }}
                        className="fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-slate-400/40 bg-slate-700 text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl active:translate-y-0 sm:bottom-[5.25rem] sm:right-6 sm:h-12 sm:w-12"
                        title={`Go up to ${['Final Balance', 'Income Transactions', 'Expense Transactions', 'Previous Balance', 'Notes'][floatingUpStep]}`}
                        aria-label={`Go up to ${['Final Balance', 'Income Transactions', 'Expense Transactions', 'Previous Balance', 'Notes'][floatingUpStep]}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0 6 6m-6-6-6 6" />
                        </svg>
                      </button>
                      
                      {/* Compact Date Filter */}
                      <div className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                        <div className="flex w-full flex-col gap-3">
                          <h2 className="text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            {t.dateSelectionTitle}
                          </h2>
                          <div className="grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1">
                            {([
                              { mode: 'all' as const, label: t.allDatesLabel },
                              { mode: 'single' as const, label: t.singleDayLabel },
                              { mode: 'range' as const, label: t.dateRangeLabel },
                            ]).map(option => (
                              <button
                                key={option.mode}
                                type="button"
                                onClick={() => setDateFilter(prev => ({ ...prev, mode: option.mode }))}
                                className={`w-full rounded-md px-2 py-2 text-xs font-bold transition ${
                                  dateFilter.mode === option.mode
                                    ? 'bg-slate-700 text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>

                          {dateFilter.mode === 'single' && (
                            <DateInput
                              compact
                              className="w-full"
                              value={dateFilter.singleDate}
                              onChange={(d) => setDateFilter(prev => ({ ...prev, singleDate: d, fromDate: d, toDate: d }))}
                            />
                          )}

                          {dateFilter.mode === 'range' && (
                            <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                              <DateInput
                                compact
                                className="w-full min-w-0"
                                value={dateFilter.fromDate}
                                onChange={(d) => setDateFilter(prev => ({ ...prev, fromDate: d }))}
                              />
                              <span className="text-xs text-slate-400">—</span>
                              <DateInput
                                compact
                                className="w-full min-w-0"
                                value={dateFilter.toDate}
                                onChange={(d) => setDateFilter(prev => ({ ...prev, toDate: d }))}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* PREVIOUS BALANCE CARD */}
                      <div ref={previousBalanceRef} className="scroll-mt-4 w-full max-w-3xl mx-auto bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-md px-4 py-5 text-white relative isolate">
                            <button 
                                type="button"
                                onClick={openBalanceModal}
                                className="absolute top-3 right-3 z-30 bg-white/25 hover:bg-white/40 active:bg-white/50 w-7 h-7 flex items-center justify-center rounded-md transition border border-white/40"
                                title={t.editOpeningBalanceTitle}
                                aria-label={t.editOpeningBalanceTitle}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} className="w-3.5 h-3.5 pointer-events-none">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                </svg>
                            </button>

                            <h2 className="text-base font-bold uppercase tracking-wider mb-4 pr-9 text-center opacity-95">{t.prevBalTitle}</h2>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 rounded-xl bg-white/20 px-4 py-2.5 backdrop-blur-sm">
                                    <p className="text-sm opacity-90 font-semibold">{t.cashBalLabel}</p>
                                    <p className="text-xl font-extrabold tabular-nums leading-tight text-right break-all">₹{formatIndianCurrency(previousBalance.cash)}</p>
                                </div>
                                <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 rounded-xl bg-white/20 px-4 py-2.5 backdrop-blur-sm">
                                    <p className="text-sm opacity-90 font-semibold">{t.onlineBalLabel}</p>
                                    <p className="text-xl font-extrabold tabular-nums leading-tight text-right break-all">₹{formatIndianCurrency(previousBalance.online)}</p>
                                </div>
                                <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 rounded-xl border border-white/30 bg-white/25 px-4 py-2.5 backdrop-blur-sm">
                                    <p className="text-sm opacity-95 font-bold">{t.totalBalLabel}</p>
                                    <p className="text-xl font-extrabold tabular-nums leading-tight text-right break-all">₹{formatIndianCurrency(previousBalance.total)}</p>
                                </div>
                            </div>
                      </div>

                      {/* EXPENSE TRANSACTIONS */}
                      <div ref={expenseTransactionsRef} className="scroll-mt-4 bg-white rounded-xl shadow-md px-4 py-5 border-l-4 border-red-500">
                          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                              <h2 className="text-lg font-extrabold tracking-wide uppercase text-red-700">
                                {t.expenseTitle}
                              </h2>
                              <button 
                                  onClick={() => openTransactionModal('expense')}
                                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm text-sm"
                              >
                                  {t.addExpenseBtn}
                              </button>
                          </div>

                          {/* Portrait: compact cards — no horizontal scroll */}
                          <div className="lg:hidden space-y-1.5">
                              {expenseTransactions.length === 0 ? (
                                  <p className="py-8 text-center text-gray-500 text-base">{t.noExpense}</p>
                              ) : (
                                  expenseTransactions.map(tr => (
                                      <article key={tr.id} className="rounded-xl border border-red-100 bg-red-50/40 px-3 py-3">
                                          <div className="flex items-center gap-2">
                                              <div className="min-w-0 flex-1">
                                                  <div className="flex items-baseline gap-1.5 min-w-0">
                                                      <p className="text-base font-bold text-slate-900 truncate">{getTranslated(tr.accountName) || '—'}</p>
                                                      <p className="text-[10px] font-semibold text-slate-400 tabular-nums shrink-0">{formatDisplayDate(tr.date)}</p>
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                      {getTranslated(tr.details) && (
                                                          <span className="text-xs text-slate-500 truncate max-w-[55%]">{getTranslated(tr.details)}</span>
                                                      )}
                                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                          {tr.paymentType}
                                                      </span>
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
                                                          {getCategoryLabel(tr.category)}
                                                      </span>
                                                  </div>
                                              </div>
                                              <p className="shrink-0 text-base font-extrabold text-red-600 tabular-nums">₹{formatIndianCurrency(tr.amount)}</p>
                                              <div className="flex shrink-0">
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); openTransactionModal(tr.type, {}, tr); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded transition" title={t.editBtn}>
                                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                                  </button>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tr.id); }} className="text-red-500 hover:bg-red-50 p-1 rounded transition" title={t.deleteBtn}>
                                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                  </button>
                                              </div>
                                          </div>
                                      </article>
                                  ))
                              )}
                              <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-3 font-bold text-base text-slate-800 flex items-center justify-between gap-2">
                                  <span>{t.expenseTotalLabel}</span>
                                  <span className="text-red-700 tabular-nums">₹{formatIndianCurrency(totalExpense)}</span>
                              </div>
                          </div>

                          {/* Landscape / desktop table */}
                          <div className="hidden lg:block">
                              <table className="w-full table-fixed">
                                  <colgroup>
                                      <col className="w-[12%]" />
                                      <col className="w-[16%]" />
                                      <col className="w-[22%]" />
                                      <col className="w-[10%]" />
                                      <col className="w-[14%]" />
                                      <col className="w-[14%]" />
                                      <col className="w-[12%]" />
                                  </colgroup>
                                  <thead className="bg-red-50">
                                      <tr>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.transactionDateLabel}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.nameLabel}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.detailsHeader}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.typeHeader}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.expenseTypeHeader}</th>
                                          <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">{t.amountHeader}</th>
                                          <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">{t.actionHeader}</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {expenseTransactions.length === 0 && (
                                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t.noExpense}</td></tr>
                                      )}
                                      {expenseTransactions.map(tr => (
                                          <tr key={tr.id} className="border-b hover:bg-gray-50">
                                              <td className="px-3 py-3 text-sm text-gray-600 tabular-nums">{formatDisplayDate(tr.date)}</td>
                                              <td className="px-3 py-3 text-sm font-bold text-gray-800 truncate">{getTranslated(tr.accountName)}</td>
                                              <td className="px-3 py-3 text-sm text-gray-600 truncate" title={getTranslated(tr.details) || undefined}>{getTranslated(tr.details)}</td>
                                              <td className="px-3 py-3">
                                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                      {tr.paymentType}
                                                  </span>
                                              </td>
                                              <td className="px-3 py-3">
                                                  <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
                                                      {getCategoryLabel(tr.category)}
                                                  </span>
                                              </td>
                                              <td className="px-3 py-3 text-right font-bold text-red-600 tabular-nums">₹{formatIndianCurrency(tr.amount)}</td>
                                              <td className="px-3 py-3 text-right">
                                                  <div className="flex justify-end items-center gap-1">
                                                      <button type="button" onClick={(e) => { e.stopPropagation(); openTransactionModal(tr.type, {}, tr); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition" title={t.editBtn}>
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                                      </button>
                                                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tr.id); }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition" title={t.deleteBtn}>
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot className="bg-red-50 border-t border-red-200">
                                      <tr>
                                          <td colSpan={3} className="px-3 py-3 font-bold text-gray-800 text-left">
                                              {t.expenseTotalLabel} <span className="text-red-700 text-lg ml-2">₹{formatIndianCurrency(totalExpense)}</span>
                                          </td>
                                          <td colSpan={4}></td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>

                      {/* INCOME TRANSACTIONS */}
                      <div ref={incomeTransactionsRef} className="scroll-mt-4 bg-white rounded-xl shadow-md px-4 py-5 border-l-4 border-green-500">
                          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                              <h2 className="text-lg font-extrabold tracking-wide uppercase text-green-700">
                                {t.incomeTitle}
                              </h2>
                              <button 
                                  onClick={() => openTransactionModal('income')}
                                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm text-sm"
                              >
                                  {t.addIncomeBtn}
                              </button>
                          </div>

                          {/* Portrait: compact cards — no horizontal scroll */}
                          <div className="lg:hidden space-y-1.5">
                              {incomeTransactions.length === 0 ? (
                                  <p className="py-8 text-center text-gray-500 text-base">{t.noIncome}</p>
                              ) : (
                                  incomeTransactions.map(tr => (
                                      <article key={tr.id} className="rounded-xl border border-green-100 bg-green-50/40 px-3 py-3">
                                          <div className="flex items-center gap-2">
                                              <div className="min-w-0 flex-1">
                                                  <div className="flex items-baseline gap-1.5 min-w-0">
                                                      <p className="text-base font-bold text-slate-900 truncate">{getTranslated(tr.accountName) || '—'}</p>
                                                      <p className="text-[10px] font-semibold text-slate-400 tabular-nums shrink-0">{formatDisplayDate(tr.date)}</p>
                                                  </div>
                                                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                      {getTranslated(tr.details) && (
                                                          <span className="text-xs text-slate-500 truncate max-w-[55%]">{getTranslated(tr.details)}</span>
                                                      )}
                                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                          {tr.paymentType}
                                                      </span>
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
                                                          {getCategoryLabel(tr.category)}
                                                      </span>
                                                  </div>
                                              </div>
                                              <p className="shrink-0 text-base font-extrabold text-green-600 tabular-nums">₹{formatIndianCurrency(tr.amount)}</p>
                                              <div className="flex shrink-0">
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); openTransactionModal(tr.type, {}, tr); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded transition" title={t.editBtn}>
                                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                                  </button>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tr.id); }} className="text-red-500 hover:bg-red-50 p-1 rounded transition" title={t.deleteBtn}>
                                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                  </button>
                                              </div>
                                          </div>
                                      </article>
                                  ))
                              )}
                              <div className="rounded-xl bg-green-50 border border-green-100 px-3 py-3 font-bold text-base text-slate-800 flex items-center justify-between gap-2">
                                  <span>{t.incomeTotalLabel}</span>
                                  <span className="text-green-700 tabular-nums">₹{formatIndianCurrency(totalIncome)}</span>
                              </div>
                          </div>

                          {/* Landscape / desktop table */}
                          <div className="hidden lg:block">
                              <table className="w-full table-fixed">
                                  <colgroup>
                                      <col className="w-[12%]" />
                                      <col className="w-[16%]" />
                                      <col className="w-[22%]" />
                                      <col className="w-[10%]" />
                                      <col className="w-[14%]" />
                                      <col className="w-[14%]" />
                                      <col className="w-[12%]" />
                                  </colgroup>
                                  <thead className="bg-green-50">
                                      <tr>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.transactionDateLabel}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.nameLabel}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.detailsHeader}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.typeHeader}</th>
                                          <th className="px-3 py-3 text-left text-sm font-semibold text-gray-700">{t.incomeTypeHeader}</th>
                                          <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">{t.amountHeader}</th>
                                          <th className="px-3 py-3 text-right text-sm font-semibold text-gray-700">{t.actionHeader}</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {incomeTransactions.length === 0 && (
                                          <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">{t.noIncome}</td></tr>
                                      )}
                                      {incomeTransactions.map(tr => (
                                          <tr key={tr.id} className="border-b hover:bg-gray-50">
                                              <td className="px-3 py-3 text-sm text-gray-600 tabular-nums">{formatDisplayDate(tr.date)}</td>
                                              <td className="px-3 py-3 text-sm font-bold text-gray-800 truncate">{getTranslated(tr.accountName)}</td>
                                              <td className="px-3 py-3 text-sm text-gray-600 truncate" title={getTranslated(tr.details) || undefined}>{getTranslated(tr.details)}</td>
                                              <td className="px-3 py-3">
                                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                                      {tr.paymentType}
                                                  </span>
                                              </td>
                                              <td className="px-3 py-3">
                                                  <span className="inline-flex px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                                                      {getCategoryLabel(tr.category)}
                                                  </span>
                                              </td>
                                              <td className="px-3 py-3 text-right font-bold text-green-600 tabular-nums">₹{formatIndianCurrency(tr.amount)}</td>
                                              <td className="px-3 py-3 text-right">
                                                  <div className="flex justify-end items-center gap-1">
                                                      <button type="button" onClick={(e) => { e.stopPropagation(); openTransactionModal(tr.type, {}, tr); }} className="text-blue-500 hover:bg-blue-50 p-2 rounded-full transition" title={t.editBtn}>
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
                                                      </button>
                                                      <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tr.id); }} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition" title={t.deleteBtn}>
                                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                                                      </button>
                                                  </div>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot className="bg-green-50 border-t border-green-200">
                                      <tr>
                                          <td colSpan={3} className="px-3 py-3 font-bold text-gray-800 text-left">
                                              {t.incomeTotalLabel} <span className="text-green-700 text-lg ml-2">₹{formatIndianCurrency(totalIncome)}</span>
                                          </td>
                                          <td colSpan={4}></td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>

                      {/* FINAL BALANCE CARD */}
                      <div ref={finalBalanceRef} className="scroll-mt-4 w-full max-w-3xl mx-auto bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow-md px-4 py-5 text-white">
                          <h2 className="text-base font-bold uppercase tracking-wider mb-4 text-center opacity-95">{t.finalBalanceTitle}</h2>
                          
                          <div className="grid grid-cols-1 gap-3">
                              <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 rounded-xl bg-white/20 px-4 py-2.5 backdrop-blur-sm">
                                  <p className="text-sm opacity-90 font-semibold">{t.cashBalLabel}</p>
                                  <p className="text-xl font-extrabold tabular-nums leading-tight text-right break-all">₹{formatIndianCurrency(finalCashBalance)}</p>
                              </div>
                              <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 rounded-xl bg-white/20 px-4 py-2.5 backdrop-blur-sm">
                                  <p className="text-sm opacity-90 font-semibold">{t.onlineBalLabel}</p>
                                  <p className="text-xl font-extrabold tabular-nums leading-tight text-right break-all">₹{formatIndianCurrency(finalOnlineBalance)}</p>
                              </div>
                              <div className="flex min-h-[3.25rem] w-full items-center justify-between gap-4 rounded-xl border border-white/30 bg-white/25 px-4 py-2.5 backdrop-blur-sm">
                                  <p className="text-sm opacity-95 font-bold">{t.totalBalLabel}</p>
                                  <p className="text-xl font-extrabold tabular-nums leading-tight text-right break-all">₹{formatIndianCurrency(finalTotalBalance)}</p>
                              </div>
                          </div>
                      </div>

                      {/* --- SUMMARY REPORT (STATS) SECTION --- */}
                      <div ref={summaryReportRef} className="scroll-mt-4 bg-white rounded-xl shadow-md px-4 py-5 border-t-4 border-indigo-500">
                          <h2 className="text-lg font-extrabold tracking-wide uppercase text-indigo-900 mb-4">
                            {t.statsTitle}
                          </h2>
                          
                          <div className="flex flex-col gap-3 mb-5">
                              <div className="w-full">
                                  <DateInput 
                                      label={t.fromDateLabel}
                                      value={statsStartDate} 
                                      onChange={setStatsStartDate}
                                  />
                              </div>
                              <div className="w-full">
                                  <DateInput 
                                      label={t.toDateLabel}
                                      value={statsEndDate} 
                                      onChange={setStatsEndDate}
                                  />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              {/* Total Expense */}
                              <div className="px-3 py-4 bg-red-50 rounded-xl border border-red-100 shadow-sm">
                                   <p className="text-xs uppercase tracking-wide font-bold text-red-500 mb-1">{t.statsTotalExpense}</p>
                                   <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.expense)}</p>
                              </div>
                              {/* Labour Expense */}
                              <div className="px-3 py-4 bg-orange-50 rounded-xl border border-orange-100 shadow-sm">
                                   <p className="text-xs uppercase tracking-wide font-bold text-orange-500 mb-1">{t.statsLabourExpense}</p>
                                   <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.labour)}</p>
                              </div>
                              {/* Oil Expense */}
                              <div className="px-3 py-4 bg-yellow-50 rounded-xl border border-yellow-100 shadow-sm">
                                   <p className="text-xs uppercase tracking-wide font-bold text-yellow-600 mb-1">{t.statsOilExpense}</p>
                                   <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.oil)}</p>
                              </div>
                              {/* Thread Expense */}
                              <div className="px-3 py-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                                      <p className="text-xs uppercase tracking-wide font-bold text-blue-600 mb-1">{t.statsElectricityExpense}</p>
                                      <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.electricity)}</p>
                              </div>
                              {/* Machine Repair */}
                              <div className="px-3 py-4 bg-teal-50 rounded-xl border border-teal-100 shadow-sm">
                                      <p className="text-xs uppercase tracking-wide font-bold text-teal-700 mb-1">{t.statsMachineRepairExpense}</p>
                                      <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.machineRepair)}</p>
                              </div>
                              {/* New Machinery */}
                              <div className="px-3 py-4 bg-violet-50 rounded-xl border border-violet-100 shadow-sm">
                                      <p className="text-xs uppercase tracking-wide font-bold text-violet-700 mb-1">{t.statsNewMachineryExpense}</p>
                                      <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.newMachinery)}</p>
                              </div>
                              {/* Other Repair */}
                              <div className="px-3 py-4 bg-rose-50 rounded-xl border border-rose-100 shadow-sm">
                                      <p className="text-xs uppercase tracking-wide font-bold text-rose-700 mb-1">{t.statsOtherRepairExpense}</p>
                                      <p className="text-xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(stats.otherRepair)}</p>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {activeTab === 'accounts' && (
                  <div className="flex min-h-[100dvh] flex-1 flex-col">
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
                  </div>
              )}

              {activeTab === 'stock' && (
                  <div className="min-h-[100dvh]">
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
                  </div>
              )}

              {activeTab === 'reports' && (
                  <div className="min-h-[100dvh]">
                    <ReportsPageController 
                        transactions={transactions}
                        stockMovements={stockMovements}
                        t={t}
                        language={language}
                        getTranslated={getTranslated}
                    />
                  </div>
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
              <div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-2 sm:p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    openingBalanceSubmittingRef.current = false;
                    setIsBalanceModalOpen(false);
                  }
                }}
              >
                  <div
                    className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl animate-fade-in relative max-h-[92vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                      <button
                        type="button"
                        onClick={() => {
                          openingBalanceSubmittingRef.current = false;
                          setIsBalanceModalOpen(false);
                        }}
                        className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center transition text-sm"
                        aria-label={t.cancelBtn}
                        title={t.cancelBtn}
                      >
                        ✕
                      </button>
                      <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 pr-8">{t.editOpeningBalanceTitle}</h3>
                      <form
                        ref={openingBalanceFormRef}
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (openingBalanceSubmittingRef.current) return;
                          openingBalanceSubmittingRef.current = true;
                          void saveOpeningBalance();
                        }}
                      >
                        <div className="mb-3 sm:mb-4">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-0.5 sm:mb-1">{t.initialCashLabel}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                autoFocus
                                value={tempOpeningBalance.cash}
                                onChange={(e) =>
                                  setTempOpeningBalance(prev => ({ ...prev, cash: formatInputCurrency(e.target.value) }))
                                }
                                className="w-full px-3 py-1.5 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                            />
                        </div>
                        <div className="mb-4 sm:mb-6">
                            <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-0.5 sm:mb-1">{t.initialOnlineLabel}</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={tempOpeningBalance.online}
                                onChange={(e) =>
                                  setTempOpeningBalance(prev => ({ ...prev, online: formatInputCurrency(e.target.value) }))
                                }
                                className="w-full px-3 py-1.5 sm:py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm sm:text-base"
                            />
                        </div>
                        <div className="flex gap-2">
                          <button
                              type="button"
                              onClick={() => {
                                openingBalanceSubmittingRef.current = false;
                                setIsBalanceModalOpen(false);
                              }}
                              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-semibold transition text-sm sm:text-base"
                          >
                              {t.cancelBtn}
                          </button>
                          <button
                              type="submit"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition text-sm sm:text-base"
                          >
                              {t.saveBtn}
                          </button>
                        </div>
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
      <EscapeStackProvider>
        <ConfirmProvider>
          <AuthGuard>
            <FinancialApp />
          </AuthGuard>
        </ConfirmProvider>
      </EscapeStackProvider>
    </AuthProvider>
  );
};

export default App;
