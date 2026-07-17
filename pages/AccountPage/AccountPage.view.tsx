

import React, { useState, useEffect } from 'react';
import { Translation, PartnerSummary, LabourSummary, AccountTab, CustomerSummary, SupplierSummary, Transaction, Language, ManualAdjustment, OwnerPreviousEntry, AccountOnlyLedgerEntry, StoredAccount, FarmerProfileDetails } from '../../types';
import { formatIndianCurrency, formatDisplayDate, formatInputCurrency, parseCurrency, formatPhoneShort, normalizeAccountName } from '../../utils';
import { TransactionModal } from '../../components/TransactionModal'; 
import { DateInput } from '../../components/DateInput';
import { useConfirm } from '../../components/ConfirmDialog';
import { ESCAPE_PRIORITY, useEscapeLayer } from '../../components/EscapeStack';

const LedgerRemoveTrashIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    className="w-5 h-5"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

const FarmerDetailsPanel: React.FC<{
  t: Translation;
  farmer?: StoredAccount;
  mode?: 'edit' | 'create';
  getTranslated: (text?: string) => string;
  onBack: () => void;
  onRenameAccount?: (oldName: string, newName: string) => void;
  onDeleteAccount?: (name: string) => void;
  onSaveFarmerDetails?: (details: FarmerProfileDetails) => void;
  onCreateFarmer?: (name: string, details: FarmerProfileDetails) => void;
  openRenameModal: (currentName: string) => void;
}> = ({
  t,
  farmer,
  mode = 'edit',
  getTranslated,
  onBack,
  onRenameAccount,
  onDeleteAccount,
  onSaveFarmerDetails,
  onCreateFarmer,
  openRenameModal,
}) => {
  const isCreate = mode === 'create';
  const [name, setName] = useState(farmer?.name || '');
  const [phone, setPhone] = useState(farmer?.phone || '');
  const [address, setAddress] = useState(farmer?.address || '');
  const [acres, setAcres] = useState(farmer?.acres != null ? String(farmer.acres) : '');
  const [dateCutter, setDateCutter] = useState(farmer?.dateCutter || '');
  const [savedFlash, setSavedFlash] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (isCreate) return;
    setName(farmer?.name || '');
    setPhone(farmer?.phone || '');
    setAddress(farmer?.address || '');
    setAcres(farmer?.acres != null ? String(farmer.acres) : '');
    setDateCutter(farmer?.dateCutter || '');
  }, [isCreate, farmer?.name, farmer?.phone, farmer?.address, farmer?.acres, farmer?.dateCutter]);

  const handleSave = () => {
    const details: FarmerProfileDetails = {
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      acres: acres.trim() ? parseFloat(acres) : undefined,
      dateCutter: dateCutter || undefined,
    };

    if (isCreate) {
      const trimmed = normalizeAccountName(name);
      if (!trimmed) {
        setNameError(t.errRequired);
        return;
      }
      setNameError('');
      setSavedFlash(true);
      onCreateFarmer?.(trimmed, details);
      onBack();
      return;
    }

    onSaveFarmerDetails?.(details);
    setSavedFlash(true);
    onBack();
  };

  const formatPhoneDisplay = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-11 h-11 rounded-full flex items-center justify-center text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 font-black text-2xl leading-none shadow-sm border border-indigo-100"
          aria-label={t.backToAccounts}
          title={t.backToAccounts}
        >
          ←
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        <div className="relative px-5 py-6 bg-gradient-to-br from-slate-800 via-indigo-900 to-indigo-700">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 0%, #a5b4fc 0, transparent 35%)' }} />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-2 text-xs font-bold leading-relaxed text-indigo-100 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-300 shrink-0" aria-hidden />
                {isCreate ? t.addSupplierAccount.replace(/^\+\s*/, '') : t.farmerDetailsTitle}
              </span>
              {!isCreate && onRenameAccount && farmer ? (
                <button
                  type="button"
                  onClick={() => openRenameModal(farmer.name)}
                  className="group mt-3 block w-full min-w-0 text-left"
                  title="Click to rename"
                >
                  <h2 className="block whitespace-normal break-words py-1 text-2xl font-semibold leading-relaxed tracking-normal text-white">
                    {getTranslated(farmer.name)}
                  </h2>
                </button>
              ) : (
                <h2 className="mt-3 whitespace-normal break-words py-1 text-2xl font-semibold leading-relaxed tracking-normal text-white">
                  {isCreate ? t.creatingSupplierAccount : getTranslated(farmer?.name)}
                </h2>
              )}
            </div>

            {!isCreate && (
              <div className="flex items-center gap-2 shrink-0">
                {onRenameAccount && farmer && (
                  <button
                    type="button"
                    onClick={() => openRenameModal(farmer.name)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center justify-center transition backdrop-blur-sm"
                    title="Rename"
                    aria-label="Rename"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                )}
                {onDeleteAccount && farmer && (
                  <button
                    type="button"
                    onClick={() => onDeleteAccount(farmer.name)}
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center justify-center transition backdrop-blur-sm"
                    title={t.deleteAccountBtn}
                    aria-label={t.deleteAccountBtn}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold leading-relaxed text-slate-500">{t.nameLabel}</label>
            {isCreate ? (
              <div>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={e => {
                    setName(e.target.value.toUpperCase());
                    if (nameError) setNameError('');
                  }}
                  placeholder={t.enterAccountName}
                  className={`w-full px-4 py-3.5 rounded-xl border bg-white text-slate-800 font-semibold text-lg uppercase focus:ring-2 focus:outline-none transition ${
                    nameError
                      ? 'border-red-400 focus:ring-red-300'
                      : 'border-violet-100 focus:ring-violet-400/40 focus:border-violet-400'
                  }`}
                />
                {nameError && <p className="text-red-500 text-sm mt-1 font-medium">{nameError}</p>}
              </div>
            ) : onRenameAccount && farmer ? (
              <button
                type="button"
                onClick={() => openRenameModal(farmer.name)}
                className="w-full text-left px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-800 font-semibold text-lg hover:bg-white hover:border-violet-200 hover:shadow-sm transition group flex items-center justify-between gap-3"
                title="Click to rename"
              >
                <span className="min-w-0 whitespace-normal break-words py-0.5 text-left leading-relaxed">{getTranslated(farmer.name)}</span>
                <span className="shrink-0 text-sm font-bold leading-relaxed text-violet-600 opacity-70 group-hover:opacity-100">
                  {t.editBtn}
                </span>
              </button>
            ) : (
              <div className="whitespace-normal break-words rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-lg font-semibold leading-relaxed text-slate-800">
                {getTranslated(farmer?.name)}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="group relative rounded-2xl border border-emerald-100/80 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold leading-relaxed text-emerald-700/80">{t.farmerPhoneLabel}</p>
                  <p className="text-sm text-emerald-600/70 font-medium">Contact</p>
                </div>
              </div>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={e => setPhone(formatPhoneDisplay(e.target.value))}
                placeholder="98765 43210"
                className="w-full px-3 py-3 rounded-xl border border-emerald-100 bg-white/90 text-slate-900 font-semibold tracking-wide text-lg focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
              />
            </div>

            <div className="group relative rounded-2xl border border-amber-100/80 bg-gradient-to-b from-amber-50/80 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm shadow-amber-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18c2.5 2 5 4.5 5 8.5S14.5 17 12 21c-2.5-4-5-6.5-5-9.5S9.5 5 12 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 14h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold leading-relaxed text-amber-800/80">{t.farmerAcresLabel}</p>
                  <p className="text-sm text-amber-700/70 font-medium">Land size</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={acres}
                  onChange={e => setAcres(e.target.value.replace(/[^\d.]/g, ''))}
                  placeholder="0.0"
                  className="w-full px-3 py-3 pr-16 rounded-xl border border-amber-100 bg-white/90 text-slate-900 font-semibold text-lg focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 focus:outline-none placeholder:text-slate-300 placeholder:font-normal"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wide text-amber-700/70 bg-amber-50 px-2 py-1 rounded-md">
                  acres
                </span>
              </div>
            </div>

            <div className="group relative rounded-2xl border border-sky-100/80 bg-gradient-to-b from-sky-50/80 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-sm shadow-sky-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold leading-relaxed text-sky-800/80">{t.farmerDateCutterLabel}</p>
                  <p className="text-sm text-sky-700/70 font-medium">Cutting day</p>
                </div>
              </div>
              <DateInput
                value={dateCutter}
                onChange={setDateCutter}
                className="[&_input]:rounded-xl [&_input]:border-sky-100 [&_input]:py-3 [&_input]:font-semibold [&_input]:text-base [&_input]:text-slate-900 [&_input]:bg-white/90 [&_input]:focus:ring-sky-400/40 [&_input]:focus:border-sky-400"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100/80 bg-gradient-to-b from-violet-50/70 to-white p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm shadow-violet-200">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold leading-relaxed text-violet-800/80">{t.farmerAddressLabel}</p>
                <p className="text-sm text-violet-700/70 font-medium">Location</p>
              </div>
            </div>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={3}
              placeholder="Village / City / Road"
              className="w-full px-3.5 py-3 rounded-xl border border-violet-100 bg-white/90 text-slate-800 font-medium text-base leading-relaxed focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400 focus:outline-none resize-y transition placeholder:text-slate-300 placeholder:font-normal"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className={`w-full py-3.5 rounded-xl font-bold shadow-md transition tracking-wide text-base ${
              savedFlash
                ? 'bg-violet-500 hover:bg-violet-500 text-white'
                : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200'
            }`}
          >
            {savedFlash
              ? t.farmerDetailsSaved
              : isCreate
                ? t.createBtn
                : t.saveFarmerDetailsBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AccountPageViewProps {
  t: Translation;
  activeTab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  // List Mode
  accountList: {
    name: string;
    balance: number;
    serial?: number;
    phone?: string;
    address?: string;
    acres?: number;
    dateCutter?: string;
  }[]; 
  onAccountSelect: (name: string) => void;
  // Detail Mode
  selectedAccountName: string | null;
  onBack: () => void;
  partnerData?: PartnerSummary;
  labourData?: LabourSummary;
  customerData?: CustomerSummary;
  supplierData?: SupplierSummary;
  selectedFarmerAccount?: StoredAccount;
  isCreatingFarmer?: boolean;
  onSaveFarmerDetails?: (details: FarmerProfileDetails) => void;
  onCreateFarmer?: (name: string, details: FarmerProfileDetails) => void;
  // Actions & Modal
  onOpenAddAccount: () => void;
  isAddModalOpen: boolean;
  newAccountName: string;
  onNewAccountNameChange: (val: string) => void;
  onConfirmAddAccount: () => void;
  onCancelAddAccount: () => void;
  
  // Rate logic
  newAccountRate: string;
  onNewAccountRateChange: (val: string) => void;

  // Farmer create fields
  newFarmerPhone?: string;
  onNewFarmerPhoneChange?: (val: string) => void;
  newFarmerAddress?: string;
  onNewFarmerAddressChange?: (val: string) => void;
  newFarmerAcres?: string;
  onNewFarmerAcresChange?: (val: string) => void;
  newFarmerDateCutter?: string;
  onNewFarmerDateCutterChange?: (val: string) => void;
  newLabourPhone?: string;
  onNewLabourPhoneChange?: (val: string) => void;
  newCustomerPhone?: string;
  onNewCustomerPhoneChange?: (val: string) => void;

  onUpdateLabourWage?: (wage: number) => void;
  onUpdateLabourProfile?: (oldName: string, newName: string, phone: string) => void;
  onUpdateCustomerProfile?: (oldName: string, newName: string, phone: string) => void;
  
  // Labour Specific
  labourStartDate?: string;
  setLabourStartDate?: (d: string) => void;
  labourEndDate?: string;
  setLabourEndDate?: (d: string) => void;
  onToggleHisaab?: (date: string) => void;
  onAddAdjustment?: (adj: { date: string, amount: number, note: string }) => void;
  onUpdateAdjustment?: (adj: ManualAdjustment) => void;
  onDeleteAdjustment?: (id: number) => void;
  
  // Month Nav
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  
  // Payments
  onPayLabour?: () => void;
  onReceiveRefund?: () => void;
  onAddAccountOnlyEntry?: (kind: 'supplier', accountName: string, entry: Omit<AccountOnlyLedgerEntry, 'id'>) => void;
  
  // PDF
  onDownloadPdf: () => void;
  pdfLanguage: Language;
  setPdfLanguage: (lang: Language) => void;
  
  // Report Dates
  reportStartDate: string;
  setReportStartDate: (d: string) => void;
  reportEndDate: string;
  setReportEndDate: (d: string) => void;

  getTranslated: (text?: string) => string;
  onUpdateSerial: (name: string, serial: number) => void;
  onRenameAccount?: (oldName: string, newName: string) => void;
  onDeleteAccount?: (name: string) => void;

  removedAccounts?: { name: string; type: string; rate?: number }[];
  onRestoreAccount?: (name: string) => void;
  onDeleteRemovedAccount?: (name: string) => void;

  onAddOwnerPreviousEntry?: (entry: Omit<OwnerPreviousEntry, 'id'>) => void;
  onUpdateOwnerPreviousEntry?: (entry: OwnerPreviousEntry) => void;
  onDeleteOwnerPreviousEntry?: (id: number) => void;
}

export const AccountPageView: React.FC<AccountPageViewProps> = ({
  t,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  accountList,
  onAccountSelect,
  selectedAccountName,
  onBack,
  partnerData,
  labourData,
  customerData,
  supplierData,
  selectedFarmerAccount,
  isCreatingFarmer = false,
  onSaveFarmerDetails,
  onCreateFarmer,
  
  onOpenAddAccount,
  isAddModalOpen,
  newAccountName,
  onNewAccountNameChange,
  onConfirmAddAccount,
  onCancelAddAccount,
  
  newAccountRate,
  onNewAccountRateChange,
  newFarmerPhone = '',
  onNewFarmerPhoneChange,
  newFarmerAddress = '',
  onNewFarmerAddressChange,
  newFarmerAcres = '',
  onNewFarmerAcresChange,
  newFarmerDateCutter = '',
  onNewFarmerDateCutterChange,
  newLabourPhone = '',
  onNewLabourPhoneChange,
  newCustomerPhone = '',
  onNewCustomerPhoneChange,
  onUpdateLabourWage,
  onUpdateLabourProfile,
  onUpdateCustomerProfile,

  labourStartDate,
  setLabourStartDate,
  labourEndDate,
  setLabourEndDate,
  onAddAdjustment,
  onUpdateAdjustment,
  onDeleteAdjustment,
  
  onPrevMonth,
  onNextMonth,
  onPayLabour,
  onReceiveRefund,
  onAddAccountOnlyEntry,
  onDownloadPdf,
  pdfLanguage,
  setPdfLanguage,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  getTranslated,
  onUpdateSerial,
  onRenameAccount,
  onDeleteAccount,
  removedAccounts = [],
  onRestoreAccount,
  onDeleteRemovedAccount,

  onAddOwnerPreviousEntry,
  onUpdateOwnerPreviousEntry,
  onDeleteOwnerPreviousEntry
}) => {
  const confirm = useConfirm();
  const askDelete = async () =>
    confirm({
      title: t.deleteBtn,
      message: t.confirmDelete,
      confirmLabel: t.deleteBtn,
      cancelLabel: t.cancelBtn,
    });
  // State for Customer View Toggle
  const [customerViewMode, setCustomerViewMode] = useState<'statement' | 'details'>('statement');
  
  // State for Adjustment/Bonus Modal
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusForm, setBonusForm] = useState({ date: new Date().toISOString().split('T')[0], amount: '', note: '' });
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<number | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'given' | 'taken'>('taken');

  // Validation States
  const [accountErrors, setAccountErrors] = useState<string>('');
  const [bonusErrors, setBonusErrors] = useState<Record<string, string>>({});
  const [labourWageDraft, setLabourWageDraft] = useState('');

  useEffect(() => {
    if (labourData) {
      setLabourWageDraft(labourData.rate ? String(labourData.rate) : '');
    }
  }, [labourData?.name, labourData?.rate]);

  const [isOwnerPrevModalOpen, setIsOwnerPrevModalOpen] = useState(false);
  const [ownerPrevForm, setOwnerPrevForm] = useState<{
    date: string;
    amount: string;
    note: string;
    kind: 'received' | 'paid';
  }>({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: '',
    kind: 'received'
  });
  const [editingOwnerPrevId, setEditingOwnerPrevId] = useState<number | null>(null);
  const [ownerPrevErrors, setOwnerPrevErrors] = useState<Record<string, string>>({});

  // Supplier/Dealer "RECEIVED" should NOT create Cashbook income.
  // We store a ledger-only entry linked to this account.
  const [isAccountOnlyModalOpen, setIsAccountOnlyModalOpen] = useState(false);
  const [accountOnlyKind, setAccountOnlyKind] = useState<'supplier'>('supplier');
  const [accountOnlyForm, setAccountOnlyForm] = useState<{ date: string; amount: string; note: string }>({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: ''
  });
  const [accountOnlyErrors, setAccountOnlyErrors] = useState<Record<string, string>>({});

  const openAccountOnlyReceivedModal = (kind: 'supplier') => {
    setAccountOnlyKind(kind);
    setAccountOnlyErrors({});
    setAccountOnlyForm({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      note: ''
    });
    setIsAccountOnlyModalOpen(true);
  };

  const submitAccountOnlyReceived = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountName || !onAddAccountOnlyEntry) return;
    const rawAmt = parseCurrency(accountOnlyForm.amount);
    const errors: Record<string, string> = {};
    if (!rawAmt || rawAmt <= 0) errors.amount = t.errPositiveAmount;
    if (!accountOnlyForm.date) errors.date = t.errRequired;
    if (Object.keys(errors).length > 0) {
      setAccountOnlyErrors(errors);
      return;
    }
    onAddAccountOnlyEntry(accountOnlyKind, selectedAccountName, {
      date: accountOnlyForm.date,
      amount: Math.abs(rawAmt),
      note: accountOnlyForm.note.trim() || undefined,
      kind: 'received'
    });
    setIsAccountOnlyModalOpen(false);
  };

  // Serial / position editor (replaces window.prompt for reliability)
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [serialEditName, setSerialEditName] = useState<string>('');
  const [serialEditValue, setSerialEditValue] = useState<string>('');

  const openSerialModal = (name: string, currentSerial?: number) => {
    setSerialEditName(name);
    setSerialEditValue(currentSerial !== undefined ? String(currentSerial) : '');
    setIsSerialModalOpen(true);
  };

  const submitSerialModal = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(serialEditValue, 10);
    if (!serialEditName) return;
    if (!isNaN(num) && num > 0) {
      onUpdateSerial(serialEditName, num);
      setIsSerialModalOpen(false);
    }
  };

  const accountOnlyModal =
    isAccountOnlyModalOpen && selectedAccountName && onAddAccountOnlyEntry ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4 text-gray-800">{t.receiveRefundBtn}</h3>
          <form onSubmit={submitAccountOnlyReceived}>
            <div className="mb-4">
              <DateInput
                label={t.dateHeader}
                value={accountOnlyForm.date}
                onChange={(d) => {
                  setAccountOnlyForm({ ...accountOnlyForm, date: d });
                  if (accountOnlyErrors.date) setAccountOnlyErrors({});
                }}
              />
              {accountOnlyErrors.date && <p className="text-red-500 text-xs mt-1">{accountOnlyErrors.date}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t.amountHeader}</label>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                  accountOnlyErrors.amount ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-green-500 border-gray-300'
                }`}
                placeholder="0"
                value={accountOnlyForm.amount}
                onChange={(e) => {
                  const formatted = formatInputCurrency(e.target.value);
                  setAccountOnlyForm({ ...accountOnlyForm, amount: formatted });
                  if (accountOnlyErrors.amount) setAccountOnlyErrors({});
                }}
              />
              {accountOnlyErrors.amount && <p className="text-red-500 text-xs mt-1">{accountOnlyErrors.amount}</p>}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">{t.detailsLabel}</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none border-gray-300"
                value={accountOnlyForm.note}
                onChange={(e) => setAccountOnlyForm({ ...accountOnlyForm, note: e.target.value })}
                placeholder={t.detailsHeader}
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold transition">
                {t.submitBtn}
              </button>
              <button
                type="button"
                onClick={() => setIsAccountOnlyModalOpen(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-bold transition"
              >
                {t.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;

  const serialModal =
    isSerialModalOpen ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Set Position</h3>
          <p className="text-xs text-gray-500 mb-4">Enter the position number where this account should appear.</p>
          <form onSubmit={submitSerialModal}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Position</label>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none border-gray-300"
                placeholder="1"
                value={serialEditValue}
                onChange={(e) => setSerialEditValue(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition">
                {t.updateBtn}
              </button>
              <button
                type="button"
                onClick={() => setIsSerialModalOpen(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-bold transition"
              >
                {t.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
    ) : null;

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameOldName, setRenameOldName] = useState<string>('');
  const [renameNewName, setRenameNewName] = useState<string>('');
  const [isLabourEditModalOpen, setIsLabourEditModalOpen] = useState(false);
  const [labourEditOldName, setLabourEditOldName] = useState('');
  const [labourEditName, setLabourEditName] = useState('');
  const [labourEditPhone, setLabourEditPhone] = useState('');
  const [labourEditErrors, setLabourEditErrors] = useState<{ name?: string; phone?: string }>({});
  const [isCustomerEditModalOpen, setIsCustomerEditModalOpen] = useState(false);
  const [customerEditOldName, setCustomerEditOldName] = useState('');
  const [customerEditName, setCustomerEditName] = useState('');
  const [customerEditPhone, setCustomerEditPhone] = useState('');
  const [customerEditErrors, setCustomerEditErrors] = useState<{ name?: string; phone?: string }>({});

  useEscapeLayer(
    'account-bonus-modal',
    () => setIsBonusModalOpen(false),
    isBonusModalOpen,
    ESCAPE_PRIORITY.modal
  );
  useEscapeLayer(
    'account-owner-prev-modal',
    () => setIsOwnerPrevModalOpen(false),
    isOwnerPrevModalOpen,
    ESCAPE_PRIORITY.modal
  );
  useEscapeLayer(
    'account-only-modal',
    () => setIsAccountOnlyModalOpen(false),
    isAccountOnlyModalOpen,
    ESCAPE_PRIORITY.modal
  );
  useEscapeLayer(
    'account-serial-modal',
    () => setIsSerialModalOpen(false),
    isSerialModalOpen,
    ESCAPE_PRIORITY.modal
  );
  useEscapeLayer(
    'account-rename-modal',
    () => setIsRenameModalOpen(false),
    isRenameModalOpen,
    ESCAPE_PRIORITY.modal
  );
  useEscapeLayer(
    'account-labour-edit-modal',
    () => setIsLabourEditModalOpen(false),
    isLabourEditModalOpen,
    ESCAPE_PRIORITY.modal
  );
  useEscapeLayer(
    'account-customer-edit-modal',
    () => setIsCustomerEditModalOpen(false),
    isCustomerEditModalOpen,
    ESCAPE_PRIORITY.modal
  );

  const openRenameModal = (currentName: string) => {
    setRenameOldName(currentName);
    setRenameNewName(currentName.toUpperCase());
    setIsRenameModalOpen(true);
  };

  const openLabourEditModal = (currentName: string, phone?: string) => {
    setLabourEditOldName(currentName);
    setLabourEditName(currentName.toUpperCase());
    const digits = (phone || '').replace(/\D/g, '').slice(0, 10);
    setLabourEditPhone(digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);
    setLabourEditErrors({});
    setIsLabourEditModalOpen(true);
  };

  const labourEditModal =
    isLabourEditModalOpen && onUpdateLabourProfile ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto relative">
          <button
            type="button"
            onClick={() => setIsLabourEditModalOpen(false)}
            className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition font-extrabold"
            aria-label={t.cancelBtn}
            title={t.cancelBtn}
          >
            ✕
          </button>
          <h3 className="text-xl font-bold mb-4 text-gray-800">{t.editBtn}</h3>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.nameLabel}</label>
            <input
              autoFocus
              type="text"
              value={labourEditName}
              onChange={(e) => {
                setLabourEditName(e.target.value.toUpperCase());
                setLabourEditErrors(prev => ({ ...prev, name: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-lg uppercase focus:ring-2 focus:ring-amber-500 focus:outline-none ${labourEditErrors.name ? 'border-red-500' : 'border-gray-300'}`}
            />
            {labourEditErrors.name && <p className="text-red-500 text-xs mt-1">{labourEditErrors.name}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerPhoneLabel}</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none ${labourEditErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="98765 43210"
              value={labourEditPhone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                const formatted = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
                setLabourEditPhone(formatted);
                setLabourEditErrors(prev => ({ ...prev, phone: undefined }));
              }}
            />
            {labourEditErrors.phone && <p className="text-red-500 text-xs mt-1">{labourEditErrors.phone}</p>}
            <p className="text-[10px] text-slate-400 mt-1">10 digits required</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextName = labourEditName.trim();
              const digits = labourEditPhone.replace(/\D/g, '');
              const errors: { name?: string; phone?: string } = {};
              if (!nextName) errors.name = t.errRequired;
              if (digits.length !== 10) errors.phone = t.errPhoneTenDigits;
              if (Object.keys(errors).length > 0) {
                setLabourEditErrors(errors);
                return;
              }
              onUpdateLabourProfile(labourEditOldName, nextName, digits);
              setIsLabourEditModalOpen(false);
            }}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-bold transition"
          >
            {t.updateBtn}
          </button>
        </div>
      </div>
    ) : null;

  const openCustomerEditModal = (currentName: string, phone?: string) => {
    setCustomerEditOldName(currentName);
    setCustomerEditName(currentName.toUpperCase());
    const digits = (phone || '').replace(/\D/g, '').slice(0, 10);
    setCustomerEditPhone(digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);
    setCustomerEditErrors({});
    setIsCustomerEditModalOpen(true);
  };

  const customerEditModal =
    isCustomerEditModalOpen && onUpdateCustomerProfile ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-xl animate-fade-in relative">
          <button
            type="button"
            onClick={() => setIsCustomerEditModalOpen(false)}
            className="absolute top-3 right-3 text-gray-700 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center font-extrabold"
          >
            ✕
          </button>
          <h3 className="text-xl font-bold mb-4 text-gray-800">{t.editBtn}</h3>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.nameLabel}</label>
            <input
              autoFocus
              type="text"
              value={customerEditName}
              onChange={(e) => {
                setCustomerEditName(e.target.value.toUpperCase());
                setCustomerEditErrors(prev => ({ ...prev, name: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded-lg uppercase focus:ring-2 focus:ring-purple-500 focus:outline-none ${customerEditErrors.name ? 'border-red-500' : 'border-gray-300'}`}
            />
            {customerEditErrors.name && <p className="text-red-500 text-xs mt-1">{customerEditErrors.name}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerPhoneLabel}</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              value={customerEditPhone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                setCustomerEditPhone(digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);
                setCustomerEditErrors(prev => ({ ...prev, phone: undefined }));
              }}
              placeholder="98765 43210"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none ${customerEditErrors.phone ? 'border-red-500' : 'border-gray-300'}`}
            />
            {customerEditErrors.phone && <p className="text-red-500 text-xs mt-1">{customerEditErrors.phone}</p>}
            <p className="text-[10px] text-slate-400 mt-1">10 digits required</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextName = customerEditName.trim();
              const digits = customerEditPhone.replace(/\D/g, '');
              const errors: { name?: string; phone?: string } = {};
              if (!nextName) errors.name = t.errRequired;
              if (digits.length !== 10) errors.phone = t.errPhoneTenDigits;
              if (Object.keys(errors).length) {
                setCustomerEditErrors(errors);
                return;
              }
              onUpdateCustomerProfile(customerEditOldName, nextName, digits);
              setIsCustomerEditModalOpen(false);
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-lg font-bold transition"
          >
            {t.updateBtn}
          </button>
        </div>
      </div>
    ) : null;

  const renameModal =
    isRenameModalOpen && onRenameAccount ? (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto relative">
          <button
            type="button"
            onClick={() => setIsRenameModalOpen(false)}
            className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition font-extrabold"
            aria-label={t.cancelBtn}
            title={t.cancelBtn}
          >
            ✕
          </button>
          <h3 className="text-xl font-bold mb-4 text-gray-800">Rename Account</h3>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t.nameLabel}</label>
            <input
              autoFocus
              type="text"
              className={`w-full px-3 py-2 border rounded-lg uppercase focus:ring-2 focus:outline-none border-gray-300 ${
                activeTab === 'supplier' ? 'focus:ring-violet-500' : 'focus:ring-blue-500'
              }`}
              value={renameNewName}
              onChange={(e) => setRenameNewName(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const next = normalizeAccountName(renameNewName);
                if (!next) return;
                onRenameAccount(renameOldName, next);
                setIsRenameModalOpen(false);
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const next = normalizeAccountName(renameNewName);
              if (!next) return;
              onRenameAccount(renameOldName, next);
              setIsRenameModalOpen(false);
            }}
            className={`w-full text-white py-2.5 rounded-lg font-bold transition ${
              activeTab === 'supplier'
                ? 'bg-violet-600 hover:bg-violet-700 shadow-sm shadow-violet-200'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {t.updateBtn}
          </button>
        </div>
      </div>
    ) : null;

  const handleOpenOwnerPrevModal = (entry?: OwnerPreviousEntry) => {
    if (entry) {
      setEditingOwnerPrevId(entry.id);
      setOwnerPrevForm({
        date: entry.date,
        amount: formatInputCurrency(String(entry.amount)),
        note: entry.note || '',
        kind: entry.kind
      });
    } else {
      setEditingOwnerPrevId(null);
      setOwnerPrevForm({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        note: '',
        kind: 'received'
      });
    }
    setOwnerPrevErrors({});
    setIsOwnerPrevModalOpen(true);
  };

  const handleOwnerPrevSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmt = parseCurrency(ownerPrevForm.amount);
    const errors: Record<string, string> = {};
    if (!rawAmt || rawAmt <= 0) errors.amount = t.errPositiveAmount;
    if (Object.keys(errors).length > 0) {
      setOwnerPrevErrors(errors);
      return;
    }
    const payload = {
      date: ownerPrevForm.date,
      amount: Math.abs(rawAmt),
      kind: ownerPrevForm.kind,
      note: ownerPrevForm.note.trim() || undefined
    };
    if (editingOwnerPrevId != null && onUpdateOwnerPreviousEntry) {
      onUpdateOwnerPreviousEntry({
        id: editingOwnerPrevId,
        ...payload
      });
    } else if (onAddOwnerPreviousEntry) {
      onAddOwnerPreviousEntry(payload);
    }
    setIsOwnerPrevModalOpen(false);
  };

  const handleOpenBonusModal = (adj?: ManualAdjustment) => {
      if (adj) {
          setEditingAdjustmentId(adj.id);
          // Detect type based on sign. Negative = Given (Reduces Payable), Positive = Taken (Increases Payable)
          setAdjustmentType(adj.amount < 0 ? 'given' : 'taken');
          setBonusForm({ 
              date: adj.date, 
              amount: Math.abs(adj.amount).toString(), 
              note: adj.note 
          });
      } else {
          setEditingAdjustmentId(null);
          setAdjustmentType('taken'); // Default to adding positive value (Work done / Bonus)
          setBonusForm({ date: new Date().toISOString().split('T')[0], amount: '', note: '' });
      }
      setBonusErrors({});
      setIsBonusModalOpen(true);
  };

  const handleBonusSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const rawAmt = parseCurrency(bonusForm.amount);
      const errors: Record<string, string> = {};
      
      if (!rawAmt || rawAmt === 0) errors.amount = t.errPositiveAmount;
      
      if (Object.keys(errors).length > 0) {
          setBonusErrors(errors);
          return;
      }

      // Apply sign based on type
      // Given: Reduces Payable -> Negative adjustment
      // Taken: Increases Payable -> Positive adjustment
      const finalAmount = adjustmentType === 'given' ? -Math.abs(rawAmt) : Math.abs(rawAmt);

      if (editingAdjustmentId && onUpdateAdjustment) {
          onUpdateAdjustment({
              id: editingAdjustmentId,
              date: bonusForm.date,
              amount: finalAmount,
              note: bonusForm.note || 'Adjustment'
          });
      } else if (onAddAdjustment) {
          onAddAdjustment({
              date: bonusForm.date,
              amount: finalAmount,
              note: bonusForm.note || 'Adjustment'
          });
      }
      setIsBonusModalOpen(false);
  };

  const handleConfirmAddAccountClick = () => {
      if (!newAccountName || !newAccountName.trim()) {
          setAccountErrors(t.enterAccountName);
          return;
      }
      if (activeTab === 'labour' || activeTab === 'customer') {
          const rawPhone = activeTab === 'labour' ? newLabourPhone : newCustomerPhone;
          const digits = (rawPhone || '').replace(/\D/g, '');
          if (digits.length !== 10) {
              setAccountErrors(t.errPhoneTenDigits);
              return;
          }
      }
      setAccountErrors('');
      onConfirmAddAccount();
  };
  
  const handleEditSerial = (e: React.MouseEvent, name: string, currentSerial?: number) => {
      e.stopPropagation();
      openSerialModal(name, currentSerial);
  };
  
  // -- Helper for Report Controls --
  const renderReportControls = () => (
      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 shadow-sm flex-wrap flex-1 justify-end">
          <div className="flex-1 min-w-[7rem]">
              <DateInput 
                  value={reportStartDate} 
                  onChange={setReportStartDate} 
                  placeholder="From"
              />
          </div>
          <span className="text-slate-500 text-base">➜</span>
          <div className="flex-1 min-w-[7rem]">
              <DateInput 
                  value={reportEndDate} 
                  onChange={setReportEndDate} 
                  placeholder="To"
              />
          </div>
          
          <div className="border-l pl-2 ml-1 flex items-center gap-2">
              <select 
                  value={pdfLanguage}
                  onChange={(e) => setPdfLanguage(e.target.value as Language)}
                  className="h-11 bg-white border border-gray-300 rounded-lg text-sm py-2 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
              >
                  <option value="en">EN</option>
                  <option value="hi">HI</option>
                  <option value="pa">PA</option>
              </select>
              <button 
                  onClick={onDownloadPdf} 
                  className="h-11 text-white bg-gray-800 hover:bg-black flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-lg shadow transition whitespace-nowrap"
                  title={t.downloadPdfBtn}
              >
                  PDF
              </button>
          </div>
      </div>
  );

  // --- RENDER DETAIL VIEW IF SELECTED ---
  if (selectedAccountName || isCreatingFarmer) {
      if (activeTab === 'customer' && customerData) {
          const isReceivable = customerData.balance >= 0;
          return (
              <div className="animate-fade-in space-y-5">
                   <div className="flex items-center justify-between gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={onBack}
                          className="w-11 h-11 rounded-full flex items-center justify-center text-purple-700 hover:text-purple-900 hover:bg-purple-50 font-black text-2xl leading-none shadow-sm shrink-0 border border-purple-100"
                          aria-label={t.backToAccounts}
                          title={t.backToAccounts}
                        >
                          ←
                        </button>
                        {renderReportControls()}
                   </div>

                   {/* Customer profile hero */}
                   <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                        <div className="relative px-5 py-6 bg-gradient-to-br from-purple-900 via-violet-800 to-purple-700">
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, white 0, transparent 42%), radial-gradient(circle at 85% 0%, #c4b5fd 0, transparent 38%)' }} />
                            <div className="relative flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-bold uppercase tracking-[0.15em] text-purple-100 backdrop-blur-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shrink-0" aria-hidden />
                                        {t.tabCustomer}
                                    </span>
                                    <div className="mt-3 flex items-center gap-3 min-w-0">
                                        <h2 className="text-2xl font-semibold text-white tracking-tight truncate">
                                            {getTranslated(customerData.name)}
                                        </h2>
                                        {onUpdateCustomerProfile && (
                                            <button
                                                type="button"
                                                onClick={() => openCustomerEditModal(customerData.name, customerData.phone)}
                                                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center justify-center transition shrink-0"
                                                title={t.editBtn}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <p className="mt-2 text-base text-purple-100/90 tabular-nums tracking-wide">
                                        {formatPhoneShort(customerData.phone)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {onDeleteAccount && (
                                        <button
                                            type="button"
                                            onClick={() => onDeleteAccount(customerData.name)}
                                            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/30 border border-white/25 text-white flex items-center justify-center transition"
                                            title={t.deleteAccountBtn}
                                            aria-label={t.deleteAccountBtn}
                                        >
                                            <LedgerRemoveTrashIcon />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="relative mt-5 pt-4 border-t border-white/15 flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold uppercase tracking-wider text-purple-200/90">{t.customerBalance}</p>
                                    <p className="text-3xl font-bold text-white tabular-nums mt-1">
                                        ₹{formatIndianCurrency(Math.abs(customerData.balance))}
                                    </p>
                                </div>
                                <span className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border ${
                                    isReceivable
                                        ? 'bg-red-500/20 border-red-300/40 text-red-100'
                                        : 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100'
                                }`}>
                                    {isReceivable ? t.statusPayable : t.statusRecoverable}
                                </span>
                            </div>
                        </div>

                        {/* View toggle */}
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <div className="inline-flex w-full p-1 rounded-xl bg-slate-200/70 border border-slate-200">
                                <button
                                    onClick={() => setCustomerViewMode('statement')}
                                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                                        customerViewMode === 'statement'
                                            ? 'bg-white shadow-sm text-purple-700 ring-1 ring-purple-100'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {t.viewStatement}
                                </button>
                                <button
                                    onClick={() => setCustomerViewMode('details')}
                                    className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                                        customerViewMode === 'details'
                                            ? 'bg-white shadow-sm text-purple-700 ring-1 ring-purple-100'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {t.viewDetails}
                                </button>
                            </div>
                        </div>
                   </div>

                   {/* --- SIMPLE STATEMENT VIEW --- */}
                   {customerViewMode === 'statement' && (
                       <div className="space-y-4">
                            {/* Summary stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50 to-white p-4 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-red-500/80">{t.totalDebit}</p>
                                    <p className="text-lg font-bold text-red-700 tabular-nums mt-2 break-all">₹{formatIndianCurrency(customerData.totalBilled)}</p>
                                </div>
                                <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">{t.totalCredit}</p>
                                    <p className="text-lg font-bold text-emerald-700 tabular-nums mt-2 break-all">₹{formatIndianCurrency(customerData.totalReceived)}</p>
                                </div>
                                <div className="rounded-xl border border-purple-100 bg-gradient-to-b from-purple-50 to-white p-4 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-purple-600/80">{t.totalNetBalance}</p>
                                    <p className={`text-lg font-bold tabular-nums mt-2 break-all ${isReceivable ? 'text-red-700' : 'text-emerald-700'}`}>
                                        ₹{formatIndianCurrency(Math.abs(customerData.balance))}
                                    </p>
                                </div>
                            </div>

                            {/* Statement — mobile cards */}
                            <div className="md:hidden bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-100">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{t.transactionHistory}</h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                {customerData.ledger.length === 0 ? (
                                    <p className="p-6 text-center text-gray-400 text-base">{t.noRecords}</p>
                                ) : (
                                    customerData.ledger.map((row) => (
                                        <article key={row.id} className="p-4">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="min-w-0">
                                                    <p className="text-base font-semibold text-slate-800 tabular-nums">{formatDisplayDate(row.date)}</p>
                                                    {getTranslated(row.description) && (
                                                        <p className="text-sm text-slate-500 truncate mt-1">{getTranslated(row.description)}</p>
                                                    )}
                                                </div>
                                                <span className={`shrink-0 inline-flex px-3 py-1 rounded-lg text-sm font-bold tabular-nums border ${
                                                    row.runningBalance >= 0
                                                        ? 'bg-red-50 text-red-700 border-red-100'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                }`}>
                                                    {formatIndianCurrency(Math.abs(row.runningBalance))} Rs
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div className="rounded-xl bg-red-50/70 border border-red-100/80 px-3 py-2.5 text-right">
                                                    <span className="text-xs font-bold uppercase text-red-400 block">{t.colDebit}</span>
                                                    {row.billedAmount > 0 && <span className="font-bold text-red-700 tabular-nums text-base">{formatIndianCurrency(row.billedAmount)}</span>}
                                                </div>
                                                <div className="rounded-xl bg-emerald-50/70 border border-emerald-100/80 px-3 py-2.5 text-right">
                                                    <span className="text-xs font-bold uppercase text-emerald-500 block">{t.colCredit}</span>
                                                    {row.receivedAmount > 0 && <span className="font-bold text-emerald-700 tabular-nums text-base">{formatIndianCurrency(row.receivedAmount)}</span>}
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                )}
                                </div>
                            </div>

                            {/* Statement Table — desktop */}
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.transactionHistory}</h3>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-gray-600">{t.dateHeader}</th>
                                            <th className="px-4 py-3 text-right font-bold text-gray-600">{t.colDebit}</th>
                                            <th className="px-4 py-3 text-right font-bold text-gray-600">{t.colCredit}</th>
                                            <th className="px-4 py-3 text-right font-bold text-gray-600">{t.colBalance}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {customerData.ledger.map((row) => (
                                            <tr key={row.id}>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="font-medium text-gray-800">{formatDisplayDate(row.date)}</div>
                                                    <div className="text-xs text-gray-400 truncate max-w-[120px]">{getTranslated(row.description)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right bg-red-50/50 align-top">
                                                    {row.billedAmount > 0 && (
                                                        <span className="font-bold text-red-600">
                                                            {formatIndianCurrency(row.billedAmount)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right bg-green-50/50 align-top">
                                                    {row.receivedAmount > 0 && (
                                                        <span className="font-bold text-green-600">
                                                            {formatIndianCurrency(row.receivedAmount)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono align-top">
                                                     <span className={row.runningBalance >= 0 ? 'text-red-600' : 'text-green-600'}>
                                                         {formatIndianCurrency(Math.abs(row.runningBalance))} Rs
                                                     </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {customerData.ledger.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-gray-400">{t.noRecords}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                       </div>
                   )}

                   {/* --- DETAILED STOCK VIEW --- */}
                   {customerViewMode === 'details' && (
                       <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-purple-100 bg-gradient-to-b from-purple-50 to-white p-4 shadow-sm col-span-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-purple-600/80">{t.customerTotalStock}</p>
                                    <p className="text-xl font-bold text-slate-800 tabular-nums mt-2">
                                        {(customerData.totalStockKg / 100).toFixed(2)} <span className="text-sm font-semibold text-slate-500">Q</span>
                                    </p>
                                    <p className="text-sm text-slate-500 mt-1">{customerData.totalStockKg} KG</p>
                                </div>
                                <div className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50 to-white p-4 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-red-500/80">{t.customerTotalBilled}</p>
                                    <p className="text-lg font-bold text-red-700 tabular-nums mt-2 break-all">₹{formatIndianCurrency(customerData.totalBilled)}</p>
                                </div>
                                <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
                                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">{t.customerTotalReceived}</p>
                                    <p className="text-lg font-bold text-emerald-700 tabular-nums mt-2 break-all">₹{formatIndianCurrency(customerData.totalReceived)}</p>
                                </div>
                                <div className="rounded-xl border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-4 shadow-sm col-span-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-violet-600/80">{t.customerBalance}</p>
                                    <p className={`text-xl font-bold tabular-nums mt-2 break-all ${customerData.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                        ₹{formatIndianCurrency(customerData.balance)}
                                    </p>
                                </div>
                            </div>

                            {/* Mobile ledger cards */}
                            <div className="md:hidden bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-100">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{t.viewDetails}</h3>
                                </div>
                                <div className="divide-y divide-slate-100">
                                {customerData.ledger.length === 0 ? (
                                    <p className="p-6 text-center text-gray-400 text-base">{t.noRecords}</p>
                                ) : (
                                    customerData.ledger.map((row) => (
                                        <article key={row.id} className="p-4">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="min-w-0">
                                                    <p className="text-base font-semibold text-slate-800 tabular-nums">{formatDisplayDate(row.date)}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        {row.vehicleNumber && (
                                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-800 text-xs font-bold uppercase tracking-wide text-white">{row.vehicleNumber}</span>
                                                        )}
                                                        {getTranslated(row.description) && (
                                                            <span className="text-sm text-slate-500 truncate">{getTranslated(row.description)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {row.quantityKg ? (
                                                    <span className="shrink-0 inline-flex px-3 py-1 rounded-lg bg-purple-50 border border-purple-100 text-sm font-bold text-purple-800 tabular-nums">
                                                        {(row.quantityKg / 100).toFixed(2)} Q
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-sm">
                                                <div className="rounded-xl bg-slate-50 border border-slate-100 px-2 py-2.5 text-center">
                                                    <span className="text-xs font-bold uppercase text-slate-400 block">{t.rateLabel}</span>
                                                    <span className="font-bold text-slate-700 tabular-nums">{row.rate ? `₹${row.rate}` : '—'}</span>
                                                </div>
                                                <div className="rounded-xl bg-red-50/70 border border-red-100/80 px-2 py-2.5 text-center">
                                                    <span className="text-xs font-bold uppercase text-red-400 block">{t.colBilled}</span>
                                                    <span className="font-bold text-red-700 tabular-nums">{row.billedAmount ? `₹${formatIndianCurrency(row.billedAmount)}` : '—'}</span>
                                                </div>
                                                <div className="rounded-xl bg-emerald-50/70 border border-emerald-100/80 px-2 py-2.5 text-center">
                                                    <span className="text-xs font-bold uppercase text-emerald-500 block">{t.colReceived}</span>
                                                    <span className="font-bold text-emerald-700 tabular-nums">{row.receivedAmount ? `₹${formatIndianCurrency(row.receivedAmount)}` : '—'}</span>
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                )}
                                </div>
                            </div>

                            {/* UNIFIED CUSTOMER LEDGER — desktop */}
                            <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.viewDetails}</h3>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b">
                                        <tr>
                                            <th className="p-3 w-32">{t.dateHeader}</th>
                                            <th className="p-3 w-64">{t.colVehicle}</th>
                                            <th className="p-3 text-right">{t.quantityLabel}</th>
                                            <th className="p-3 text-right">{t.rateLabel}</th>
                                            <th className="p-3 text-right bg-red-50">{t.colBilled}</th>
                                            <th className="p-3 text-right bg-green-50">{t.colReceived}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {customerData.ledger.map((row) => (
                                            <tr key={row.id} className="hover:bg-gray-50">
                                                <td className="p-3 text-gray-600 font-medium">{formatDisplayDate(row.date)}</td>
                                                <td className="p-3">
                                                    {row.vehicleNumber && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-bold uppercase tracking-wide text-white mr-2">{row.vehicleNumber}</span>
                                                    )}
                                                    <span className="text-gray-500">{getTranslated(row.description)}</span>
                                                </td>
                                                <td className="p-3 text-right font-mono text-gray-700">
                                                    {row.quantityKg ? (
                                                        <span>{(row.quantityKg / 100).toFixed(2)} Q</span>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-3 text-right font-mono text-gray-500">
                                                    {row.rate ? `₹${row.rate}` : '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold text-red-700 bg-red-50/30">
                                                    {row.billedAmount ? `₹${formatIndianCurrency(row.billedAmount)}` : '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold text-green-700 bg-green-50/30">
                                                    {row.receivedAmount ? `₹${formatIndianCurrency(row.receivedAmount)}` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {customerData.ledger.length === 0 && (
                                            <tr><td colSpan={6} className="p-8 text-center text-gray-400">{t.noRecords}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                       </div>
                   )}
                  {accountOnlyModal}
                  {customerEditModal}
              </div>
          );
      } else if (activeTab === 'supplier' && (selectedFarmerAccount || isCreatingFarmer)) {
          return (
              <>
                <FarmerDetailsPanel
                  t={t}
                  farmer={selectedFarmerAccount}
                  mode={isCreatingFarmer ? 'create' : 'edit'}
                  getTranslated={getTranslated}
                  onBack={onBack}
                  onRenameAccount={onRenameAccount}
                  onDeleteAccount={onDeleteAccount}
                  onSaveFarmerDetails={onSaveFarmerDetails}
                  onCreateFarmer={onCreateFarmer}
                  openRenameModal={openRenameModal}
                />
                {renameModal}
              </>
          );

      } else if (activeTab === 'partner' && partnerData) {
        const isPositiveNet = partnerData.netBalance >= 0;
        return (
          <div className="animate-fade-in space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sky-700 hover:text-sky-900 hover:bg-sky-50 font-black text-2xl leading-none shadow-sm shrink-0 border border-sky-100"
                  aria-label={t.backToAccounts}
                  title={t.backToAccounts}
                >
                  ←
                </button>
                {renderReportControls()}
            </div>

            {/* Owner profile hero */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="relative px-5 py-6 bg-gradient-to-br from-sky-900 via-blue-800 to-sky-700">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, white 0, transparent 42%), radial-gradient(circle at 85% 0%, #7dd3fc 0, transparent 38%)' }} />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-bold uppercase tracking-[0.15em] text-sky-100 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0" aria-hidden />
                      {t.tabPartner}
                    </span>
                    <div className="mt-3 flex items-center gap-3 min-w-0">
                      <h2 className="text-2xl font-semibold text-white tracking-tight truncate">
                        {getTranslated(partnerData.name)}
                      </h2>
                      {onRenameAccount && (
                        <button
                          type="button"
                          onClick={() => openRenameModal(partnerData.name)}
                          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center justify-center transition shrink-0"
                          title="Rename Account"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  {onDeleteAccount && (
                    <button
                      type="button"
                      onClick={() => onDeleteAccount(partnerData.name)}
                      className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/30 border border-white/25 text-white flex items-center justify-center transition shrink-0"
                      title={t.deleteAccountBtn}
                      aria-label={t.deleteAccountBtn}
                    >
                      <LedgerRemoveTrashIcon />
                    </button>
                  )}
                </div>
                <div className="relative mt-5 pt-4 border-t border-white/15 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-sky-200/90">{t.netPosition}</p>
                    <p className="text-3xl font-bold text-white tabular-nums mt-1">
                      ₹{formatIndianCurrency(Math.abs(partnerData.netBalance))}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border ${
                    isPositiveNet
                      ? 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100'
                      : 'bg-red-500/20 border-red-300/40 text-red-100'
                  }`}>
                    {isPositiveNet ? t.statusRecoverable : t.statusPayable}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border-b border-slate-100">
                <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/80">{t.moneyIn}</p>
                  <p className="text-xl font-bold text-emerald-700 tabular-nums mt-2 break-all">₹{formatIndianCurrency(partnerData.totalIn)}</p>
                </div>
                <div className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-500/80">{t.moneyOut}</p>
                  <p className="text-xl font-bold text-red-700 tabular-nums mt-2 break-all">₹{formatIndianCurrency(partnerData.totalOut)}</p>
                </div>
              </div>
            </div>

            {/* Cashbook linked transactions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{t.ownerLinkedBookTitle}</h3>
              </div>
              <div className="flex flex-col gap-0">
                <div className="flex-1 flex flex-col border-b border-slate-100">
                  <div className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
                    <p className="text-sm font-bold uppercase tracking-wider text-emerald-800">{t.moneyIn}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {partnerData.transactionsIn.length === 0 ? (
                      <p className="text-gray-400 text-center text-base py-6">{t.noRecords}</p>
                    ) : (
                      partnerData.transactionsIn.map(tr => (
                        <div key={tr.id} className="rounded-xl border border-emerald-100/80 bg-emerald-50/40 p-4 flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-lg text-slate-800 tabular-nums">₹{formatIndianCurrency(tr.amount)}</p>
                            <p className="text-sm text-slate-500 tabular-nums mt-1">{formatDisplayDate(tr.date)}</p>
                          </div>
                          <span className="shrink-0 inline-flex px-3 py-1 rounded-lg bg-white border border-emerald-100 text-xs font-semibold uppercase text-emerald-700">
                            {tr.paymentType}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <div className="px-4 py-3 bg-red-50/80 border-b border-red-100 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
                    <p className="text-sm font-bold uppercase tracking-wider text-red-800">{t.moneyOut}</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {partnerData.transactionsOut.length === 0 ? (
                      <p className="text-gray-400 text-center text-base py-6">{t.noRecords}</p>
                    ) : (
                      partnerData.transactionsOut.map(tr => (
                        <div key={tr.id} className="rounded-xl border border-red-100/80 bg-red-50/40 p-4 flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-lg text-slate-800 tabular-nums">₹{formatIndianCurrency(tr.amount)}</p>
                            <p className="text-sm text-slate-500 tabular-nums mt-1">{formatDisplayDate(tr.date)}</p>
                            {getTranslated(tr.details) && (
                              <p className="text-sm text-slate-400 truncate mt-1">{getTranslated(tr.details)}</p>
                            )}
                          </div>
                          <span className="shrink-0 inline-flex px-3 py-1 rounded-lg bg-white border border-red-100 text-xs font-semibold uppercase text-red-700">
                            {tr.paymentType}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Owner-only previous amounts — compact, only expand when entries exist */}
            {(() => {
              const hasPrevEntries = partnerData.previousReceived.length > 0 || partnerData.previousPaid.length > 0;
              return (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{t.ownerPreviousSectionTitle}</h3>
                    {(onAddOwnerPreviousEntry || onUpdateOwnerPreviousEntry) && (
                      <button
                        type="button"
                        onClick={() => handleOpenOwnerPrevModal()}
                        className="shrink-0 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm transition"
                      >
                        {t.addOwnerPreviousEntryBtn}
                      </button>
                    )}
                  </div>
                  {hasPrevEntries ? (
                    <div className="flex flex-col gap-0">
                      {partnerData.previousReceived.length > 0 && (
                        <div className="flex-1 flex flex-col border-b border-slate-50">
                          <div className="px-4 py-3 bg-emerald-50/60 border-b border-emerald-100/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{t.ownerPreviousKindReceived}</p>
                          </div>
                          <div className="p-3 space-y-2">
                            {partnerData.previousReceived.map((row) => (
                              <div key={row.id} className="rounded-xl border border-emerald-100/80 bg-emerald-50/30 p-4 flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-lg text-slate-800 tabular-nums">₹{formatIndianCurrency(row.amount)}</p>
                                  <p className="text-sm text-slate-500 tabular-nums mt-1">{formatDisplayDate(row.date)}</p>
                                  {row.note && <p className="text-sm text-slate-400 mt-1 truncate">{getTranslated(row.note)}</p>}
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  {onUpdateOwnerPreviousEntry && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenOwnerPrevModal({ ...row });
                                      }}
                                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm text-sky-700 border border-sky-200 hover:bg-sky-50 transition"
                                      title={t.editBtn}
                                      aria-label={t.editBtn}
                                    >
                                      ✎
                                    </button>
                                  )}
                                  {onDeleteOwnerPreviousEntry && (
                                    <button type="button" onClick={async () => { if (await askDelete()) onDeleteOwnerPreviousEntry(row.id); }} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold">{t.deleteBtn}</button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {partnerData.previousPaid.length > 0 && (
                        <div className="flex-1 flex flex-col">
                          <div className="px-4 py-3 bg-red-50/60 border-b border-red-100/60">
                            <p className="text-xs font-bold uppercase tracking-wider text-red-700">{t.ownerPreviousKindPaid}</p>
                          </div>
                          <div className="p-3 space-y-2">
                            {partnerData.previousPaid.map((row) => (
                              <div key={row.id} className="rounded-xl border border-red-100/80 bg-red-50/30 p-4 flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <p className="font-bold text-lg text-slate-800 tabular-nums">₹{formatIndianCurrency(row.amount)}</p>
                                  <p className="text-sm text-slate-500 tabular-nums mt-1">{formatDisplayDate(row.date)}</p>
                                  {row.note && <p className="text-sm text-slate-400 mt-1 truncate">{getTranslated(row.note)}</p>}
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  {onUpdateOwnerPreviousEntry && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleOpenOwnerPrevModal({ ...row });
                                      }}
                                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm text-sky-700 border border-sky-200 hover:bg-sky-50 transition"
                                      title={t.editBtn}
                                      aria-label={t.editBtn}
                                    >
                                      ✎
                                    </button>
                                  )}
                                  {onDeleteOwnerPreviousEntry && (
                                    <button type="button" onClick={async () => { if (await askDelete()) onDeleteOwnerPreviousEntry(row.id); }} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-bold">{t.deleteBtn}</button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5 text-center">
                      <p className="text-sm text-slate-400">{t.noRecords}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {isOwnerPrevModalOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md shadow-xl animate-fade-in relative max-h-[92vh] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setIsOwnerPrevModalOpen(false)}
                    className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition font-extrabold"
                    aria-label={t.cancelBtn}
                    title={t.cancelBtn}
                  >
                    ✕
                  </button>
                  <h3 className="text-xl font-bold mb-4 text-gray-800">
                    {editingOwnerPrevId ? t.ownerPreviousModalEdit : t.ownerPreviousModalAdd}
                  </h3>
                  <form onSubmit={handleOwnerPrevSubmit}>
                    <div className="mb-4">
                      <DateInput
                        label={t.dateHeader}
                        value={ownerPrevForm.date}
                        onChange={(d) => setOwnerPrevForm({ ...ownerPrevForm, date: d })}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">{t.adjustmentTypeLabel}</label>
                      <div className="space-y-2">
                        <label
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${ownerPrevForm.kind === 'received' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'hover:bg-gray-50 border-gray-200'}`}
                        >
                          <input
                            type="radio"
                            name="ownerPrevKind"
                            checked={ownerPrevForm.kind === 'received'}
                            onChange={() => setOwnerPrevForm({ ...ownerPrevForm, kind: 'received' })}
                            className="w-4 h-4 text-green-600"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-800">{t.ownerPreviousKindReceived}</span>
                        </label>
                        <label
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${ownerPrevForm.kind === 'paid' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'hover:bg-gray-50 border-gray-200'}`}
                        >
                          <input
                            type="radio"
                            name="ownerPrevKind"
                            checked={ownerPrevForm.kind === 'paid'}
                            onChange={() => setOwnerPrevForm({ ...ownerPrevForm, kind: 'paid' })}
                            className="w-4 h-4 text-red-600"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-800">{t.ownerPreviousKindPaid}</span>
                        </label>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t.adjustmentAmount}</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${ownerPrevErrors.amount ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-blue-500 border-gray-300'}`}
                        value={ownerPrevForm.amount}
                        onChange={(e) => {
                          setOwnerPrevForm({ ...ownerPrevForm, amount: formatInputCurrency(e.target.value) });
                          setOwnerPrevErrors({});
                        }}
                        placeholder="0"
                      />
                      {ownerPrevErrors.amount && (
                        <p className="text-red-500 text-xs mt-1">{ownerPrevErrors.amount}</p>
                      )}
                    </div>
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t.detailsLabel}</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none border-gray-300"
                        value={ownerPrevForm.note}
                        onChange={(e) => setOwnerPrevForm({ ...ownerPrevForm, note: e.target.value })}
                        placeholder={t.adjustmentNote}
                      />
                    </div>
                    <div className="flex gap-3 items-stretch">
                      <button
                        type="submit"
                        className="flex-1 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition"
                      >
                        {editingOwnerPrevId ? t.updateBtn : t.submitBtn}
                      </button>
                      {editingOwnerPrevId != null && onDeleteOwnerPreviousEntry && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (await askDelete()) {
                              onDeleteOwnerPreviousEntry(editingOwnerPrevId);
                              setIsOwnerPrevModalOpen(false);
                            }
                          }}
                          className="bg-red-100 hover:bg-red-200 text-red-700 px-4 rounded-lg font-bold transition"
                          title={t.deleteBtn}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            )}
            {renameModal}
          </div>
        );
      } else if (activeTab === 'labour' && labourData) {
        const isPayable = labourData.lifetimeBalance > 0;
        const openingRow = labourData.ledger.find(r => r.isOpeningBalance);
        const activityRows = labourData.ledger.filter(r => !r.isOpeningBalance);
        return (
          <div className="animate-fade-in space-y-3 sm:space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={onBack}
                className="w-11 h-11 rounded-full flex items-center justify-center text-amber-700 hover:text-amber-900 hover:bg-amber-50 font-black text-2xl leading-none shadow-sm shrink-0 border border-amber-100"
                aria-label={t.backToAccounts}
                title={t.backToAccounts}
              >
                ←
              </button>
              <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
                <button
                  type="button"
                  onClick={() => handleOpenBonusModal()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl font-bold shadow-sm transition text-sm"
                >
                  {t.addAdjustmentBtn}
                </button>
                <div className="border-l pl-2 ml-1 flex items-center gap-2">
                  <select
                    value={pdfLanguage}
                    onChange={(e) => setPdfLanguage(e.target.value as Language)}
                    className="h-11 bg-white border border-gray-300 rounded-lg text-sm py-2 px-2 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-gray-700"
                  >
                    <option value="en">EN</option>
                    <option value="hi">HI</option>
                    <option value="pa">PA</option>
                  </select>
                  <button onClick={onDownloadPdf} className="h-11 text-white bg-gray-800 hover:bg-black flex items-center gap-1 text-sm font-bold px-4 py-2 rounded-lg shadow transition">
                    PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
              <div className="relative px-5 py-6 bg-gradient-to-br from-amber-900 via-orange-800 to-amber-700">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, white 0, transparent 42%), radial-gradient(circle at 85% 0%, #fcd34d 0, transparent 38%)' }} />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-bold uppercase tracking-[0.15em] text-amber-100 backdrop-blur-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shrink-0" aria-hidden />
                      {t.tabLabour}
                    </span>
                    <div className="mt-3 flex items-center gap-3 min-w-0">
                      <h2 className="text-2xl font-semibold text-white tracking-tight truncate">
                        {getTranslated(labourData.name)}
                      </h2>
                      {onUpdateLabourProfile && (
                        <button
                          type="button"
                          onClick={() => openLabourEditModal(labourData.name, labourData.phone)}
                          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white flex items-center justify-center transition shrink-0"
                          title={t.editBtn}
                          aria-label={t.editBtn}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {labourData.phone ? (
                      <p className="mt-2 text-base text-amber-100/90 tabular-nums tracking-wide">
                        {formatPhoneShort(labourData.phone)}
                      </p>
                    ) : (
                      <p className="mt-2 text-base text-amber-200/60 tabular-nums">
                        —
                      </p>
                    )}
                  </div>
                  {onDeleteAccount && (
                    <button
                      type="button"
                      onClick={() => onDeleteAccount(labourData.name)}
                      className="w-10 h-10 rounded-xl bg-white/10 hover:bg-red-500/30 border border-white/25 text-white flex items-center justify-center transition shrink-0"
                      title={t.deleteAccountBtn}
                      aria-label={t.deleteAccountBtn}
                    >
                      <LedgerRemoveTrashIcon />
                    </button>
                  )}
                </div>
                <div className="relative mt-5 pt-4 border-t border-white/15 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-amber-200/90">{t.totalNetBalance}</p>
                    <p className="text-3xl font-bold text-white tabular-nums mt-1">
                      ₹{formatIndianCurrency(Math.abs(labourData.lifetimeBalance))}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border ${
                    isPayable
                      ? 'bg-red-500/20 border-red-300/40 text-red-100'
                      : 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100'
                  }`}>
                    {isPayable ? t.statusPayable : t.statusRecoverable}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border-b border-slate-100">
                <div className="rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-600/80 truncate">{t.labourWageLabel}</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={labourWageDraft}
                    onChange={(e) => setLabourWageDraft(formatInputCurrency(e.target.value))}
                    onBlur={() => {
                      const val = parseCurrency(labourWageDraft) || 0;
                      if (val !== labourData.rate) onUpdateLabourWage?.(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className="mt-2 w-full text-xl font-bold text-amber-800 tabular-nums bg-white/70 border border-amber-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    aria-label={t.labourWageLabel}
                  />
                </div>
                <div className="rounded-xl border border-red-100 bg-gradient-to-b from-red-50 to-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-500/80">{t.labourTotalGivenLabel}</p>
                  <p className="mt-2 text-xl font-bold text-red-700 tabular-nums">₹{formatIndianCurrency(labourData.lifetimePaid)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch justify-between gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 justify-center">
                <button onClick={onPrevMonth} className="w-11 h-11 hover:bg-slate-100 rounded-full transition text-slate-700 font-bold text-xl border border-slate-200" title={t.prevMonth}>&lt;</button>
                <button onClick={onNextMonth} className="w-11 h-11 hover:bg-slate-100 rounded-full transition text-slate-700 font-bold text-xl border border-slate-200" title={t.nextMonth}>&gt;</button>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="flex-1 min-w-0">
                  <DateInput value={labourStartDate || ''} onChange={(d) => setLabourStartDate && setLabourStartDate(d)} />
                </div>
                <span className="text-slate-500 text-base">➜</span>
                <div className="flex-1 min-w-0">
                  <DateInput value={labourEndDate || ''} onChange={(d) => setLabourEndDate && setLabourEndDate(d)} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">{t.labourLedgerTitle}</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {openingRow && (
                  <div className="p-4 bg-slate-50/80 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-700">Opening Balance</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDisplayDate(openingRow.date)}</p>
                    </div>
                    <span className={`text-lg font-bold tabular-nums ${openingRow.runningBalance > 0 ? 'text-red-600' : openingRow.runningBalance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      ₹{formatIndianCurrency(Math.abs(openingRow.runningBalance))}
                    </span>
                  </div>
                )}
                {activityRows.length === 0 ? (
                  <p className="p-6 text-center text-slate-400 text-sm">{t.noRecords}</p>
                ) : (
                  activityRows.map((row) => {
                    const canEdit = row.adjustmentId != null;
                    return (
                      <div
                        key={row.id}
                        className="p-4 flex items-center justify-between gap-4 bg-white"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-semibold text-slate-800 tabular-nums">{formatDisplayDate(row.date)}</p>
                            <span className="inline-flex px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide border bg-emerald-50 text-emerald-700 border-emerald-100">
                              {t.adjustmentTitle.split('/')[0].trim()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1 truncate">{row.description}</p>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          {row.debitAmount > 0 && (
                            <p className="text-lg font-bold text-red-600 tabular-nums">- ₹{formatIndianCurrency(row.debitAmount)}</p>
                          )}
                          {row.creditAmount > 0 && (
                            <p className="text-lg font-bold text-emerald-700 tabular-nums">+ ₹{formatIndianCurrency(row.creditAmount)}</p>
                          )}
                          {canEdit && row.adjustment && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenBonusModal({ ...row.adjustment! });
                              }}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-sm text-amber-700 border border-amber-200 hover:bg-amber-50 transition"
                              title={t.editBtn}
                              aria-label={t.editBtn}
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ADJUSTMENT / BONUS MODAL */}
            {isBonusModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md shadow-xl animate-fade-in relative max-h-[92vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setIsBonusModalOpen(false)}
                            className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition font-extrabold"
                            aria-label={t.cancelBtn}
                            title={t.cancelBtn}
                        >
                            ✕
                        </button>
                        <h3 className="text-xl font-bold mb-4 text-gray-800">
                            {editingAdjustmentId ? t.editBtn : t.adjustmentTitle}
                        </h3>
                        <form onSubmit={handleBonusSubmit}>
                            <div className="mb-4">
                                <DateInput 
                                    label={t.dateHeader}
                                    value={bonusForm.date}
                                    onChange={(d) => setBonusForm({...bonusForm, date: d})}
                                />
                            </div>

                            {/* Adjustment Type Selector */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">{t.adjustmentTypeLabel}</label>
                                <div className="space-y-2">
                                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${adjustmentType === 'taken' ? 'bg-green-50 border-green-500 ring-1 ring-green-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                        <input 
                                            type="radio" 
                                            name="adjType" 
                                            value="taken"
                                            checked={adjustmentType === 'taken'}
                                            onChange={() => setAdjustmentType('taken')}
                                            className="w-4 h-4 text-green-600"
                                        />
                                        <span className="ml-2 text-sm font-medium text-gray-800">
                                            {t.moneyTakenLabel}
                                        </span>
                                    </label>
                                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${adjustmentType === 'given' ? 'bg-red-50 border-red-500 ring-1 ring-red-500' : 'hover:bg-gray-50 border-gray-200'}`}>
                                        <input 
                                            type="radio" 
                                            name="adjType" 
                                            value="given"
                                            checked={adjustmentType === 'given'}
                                            onChange={() => setAdjustmentType('given')}
                                            className="w-4 h-4 text-red-600"
                                        />
                                        <span className="ml-2 text-sm font-medium text-gray-800">
                                            {t.moneyGivenLabel}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.adjustmentAmount}</label>
                                <input 
                                    type="text"
                                    inputMode="numeric"
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${bonusErrors.amount ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-blue-500 border-gray-300'}`}
                                    value={bonusForm.amount}
                                    onChange={e => { setBonusForm({...bonusForm, amount: formatInputCurrency(e.target.value)}); setBonusErrors({}); }}
                                    placeholder="0"
                                />
                                {bonusErrors.amount && <p className="text-red-500 text-xs mt-1">{bonusErrors.amount}</p>}
                            </div>
                            <div className="mb-6">
                                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.adjustmentNote}</label>
                                <input 
                                    type="text"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none border-gray-300"
                                    value={bonusForm.note}
                                    onChange={e => setBonusForm({...bonusForm, note: e.target.value})}
                                    placeholder="e.g. Bonus, Advance, Previous Balance"
                                />
                            </div>
                            <div className="flex gap-3 items-stretch">
                                <button type="submit" className="flex-1 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition">
                                    {editingAdjustmentId ? t.updateBtn : t.submitBtn}
                                </button>
                                {editingAdjustmentId && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if ((await askDelete()) && onDeleteAdjustment) {
                                                onDeleteAdjustment(editingAdjustmentId);
                                                setIsBonusModalOpen(false);
                                            }
                                        }}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 px-4 rounded-lg font-bold transition"
                                        title={t.deleteBtn}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {labourEditModal}
          </div>
        );
      }
      // If selected but data mismatch, fall back to list (safe default)
  }

  // --- LIST VIEW (DEFAULT) ---
  return (
    <div className="bg-white rounded-lg shadow min-h-[100dvh] flex-1 flex flex-col relative">
      {/* Account Type Tabs */}
      <div className="bg-slate-50 border-t-[3px] border-t-slate-800 border-b border-b-slate-200 px-3 py-3">
        <div className="tab-strip grid grid-cols-2 gap-2">
          {([
            {
              id: 'labour' as const,
              label: t.tabLabour,
              active: 'bg-amber-400 text-amber-950 shadow-sm',
            },
            {
              id: 'partner' as const,
              label: t.tabPartner,
              active: 'bg-sky-500 text-white shadow-sm',
            },
            {
              id: 'customer' as const,
              label: t.tabCustomer,
              active: 'bg-purple-600 text-white shadow-sm',
            },
            {
              id: 'supplier' as const,
              label: t.tabSupplier,
              active: 'bg-violet-600 text-white shadow-sm',
            },
          ]).map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`flex w-full min-w-0 items-center justify-center border text-center py-4 px-3 rounded-xl text-sm font-bold whitespace-nowrap leading-snug transition-all duration-150 ${
                  isActive
                    ? `${tab.active} border-transparent`
                    : 'border-slate-200 bg-white text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions & Search */}
      <div className="p-4 border-b bg-gray-50 flex flex-col gap-3 items-center justify-between">
         <div className="w-full">
             <input 
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-base"
             />
         </div>
         <button 
             onClick={onOpenAddAccount}
             className={`w-full px-4 py-3 font-bold rounded-xl shadow-sm transition text-base whitespace-nowrap ${
                 activeTab === 'labour'
                    ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-amber-400/30'
                    : activeTab === 'partner'
                    ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/30'
                    : activeTab === 'customer'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
                    : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/30'
             }`}
         >
             {activeTab === 'labour' ? t.addLabourAccount : 
              (activeTab === 'customer' ? t.addCustomerAccount : 
              (activeTab === 'supplier' ? t.addSupplierAccount : t.addPartnerAccount))}
         </button>
      </div>

      {/* List */}
      <div className="flex-1 p-3">
         <div className={`grid gap-3 ${
           activeTab === 'supplier'
             ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
             : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
         }`}>
            {accountList.map((acc, index) => (
               activeTab === 'customer' ? (
               <div
                  key={acc.name}
                  onClick={() => onAccountSelect(acc.name)}
                  className="relative overflow-hidden rounded-xl border border-purple-100/90 bg-white cursor-pointer hover:shadow-lg hover:border-purple-200 transition-all group shadow-sm"
               >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-violet-600" aria-hidden />
                  <div className="p-4 pl-5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          onClick={(e) => handleEditSerial(e, acc.name, acc.serial)}
                          title="Click to set custom order"
                          className="text-sm font-bold w-10 h-10 shrink-0 rounded-xl bg-purple-100 text-purple-800 border border-purple-200/80 cursor-pointer inline-flex items-center justify-center hover:bg-purple-200 transition-colors shadow-sm"
                        >
                          {acc.serial !== undefined ? acc.serial : index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base text-slate-800 truncate group-hover:text-purple-800 transition-colors leading-tight">
                            {getTranslated(acc.name)}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex px-2 py-1 rounded-md bg-purple-50 border border-purple-100 text-xs font-bold uppercase tracking-wider text-purple-600">
                              {t.tabCustomer}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg bg-white border border-purple-200/90 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-purple-600 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              <span className="text-sm font-bold text-slate-800 tabular-nums">
                                {formatPhoneShort(acc.phone)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-purple-300 group-hover:text-purple-500 text-xl transition-colors">➔</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-purple-50 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">{t.accountBalance}</p>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-base font-bold tabular-nums border ${
                        acc.balance >= 0
                          ? 'bg-red-50 text-red-700 border-red-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        ₹{formatIndianCurrency(acc.balance)}
                      </span>
                    </div>
                  </div>
               </div>
               ) : activeTab === 'partner' ? (
               <div
                  key={acc.name}
                  onClick={() => onAccountSelect(acc.name)}
                  className="relative overflow-hidden rounded-xl border border-sky-100/90 bg-white cursor-pointer hover:shadow-lg hover:border-sky-200 transition-all group shadow-sm"
               >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-sky-500 to-blue-600" aria-hidden />
                  <div className="p-4 pl-5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          onClick={(e) => handleEditSerial(e, acc.name, acc.serial)}
                          title="Click to set custom order"
                          className="text-sm font-bold w-10 h-10 shrink-0 rounded-xl bg-sky-100 text-sky-800 border border-sky-200/80 cursor-pointer inline-flex items-center justify-center hover:bg-sky-200 transition-colors shadow-sm"
                        >
                          {acc.serial !== undefined ? acc.serial : index + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-slate-800 truncate group-hover:text-sky-800 transition-colors leading-tight">
                            {getTranslated(acc.name)}
                          </h3>
                          <span className="inline-flex mt-1 px-2 py-1 rounded-md bg-sky-50 border border-sky-100 text-xs font-bold uppercase tracking-wider text-sky-600">
                            {t.tabPartner}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-sky-300 group-hover:text-sky-500 text-xl transition-colors">➔</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-sky-50 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">{t.netPosition}</p>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-base font-bold tabular-nums border ${
                        acc.balance >= 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-red-50 text-red-700 border-red-100'
                      }`}>
                        ₹{formatIndianCurrency(Math.abs(acc.balance))}
                      </span>
                    </div>
                  </div>
               </div>
               ) : activeTab === 'labour' ? (
               <div
                  key={acc.name}
                  onClick={() => onAccountSelect(acc.name)}
                  className="relative overflow-hidden rounded-xl border border-amber-100/90 bg-white cursor-pointer hover:shadow-lg hover:border-amber-200 transition-all group shadow-sm"
               >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-orange-600" aria-hidden />
                  <div className="p-4 pl-5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          onClick={(e) => handleEditSerial(e, acc.name, acc.serial)}
                          title="Click to set custom order"
                          className="text-sm font-bold w-10 h-10 shrink-0 rounded-xl bg-amber-100 text-amber-800 border border-amber-200/80 cursor-pointer inline-flex items-center justify-center hover:bg-amber-200 transition-colors shadow-sm"
                        >
                          {acc.serial !== undefined ? acc.serial : index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base text-slate-800 truncate group-hover:text-amber-800 transition-colors leading-tight">
                            {getTranslated(acc.name)}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex px-2 py-1 rounded-md bg-amber-50 border border-amber-100 text-xs font-bold uppercase tracking-wider text-amber-700">
                              {t.tabLabour}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg bg-white border border-amber-200/90 shadow-sm">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                              </svg>
                              <span className="text-sm font-bold text-slate-800 tabular-nums tracking-wide">
                                {formatPhoneShort(acc.phone)}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 text-amber-300 group-hover:text-amber-500 text-xl transition-colors">➔</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-50 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 truncate">{t.totalNetBalance}</p>
                      <span className={`inline-flex px-3 py-1 rounded-lg text-base font-bold tabular-nums border ${
                        acc.balance > 0
                          ? 'bg-red-50 text-red-700 border-red-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        ₹{formatIndianCurrency(Math.abs(acc.balance))}
                      </span>
                    </div>
                  </div>
               </div>
               ) : (
               <div 
                  key={acc.name} 
                  onClick={() => onAccountSelect(acc.name)}
                  className="border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all bg-white flex flex-col justify-between group border-indigo-100 hover:border-indigo-200"
               >
                  <div className="flex justify-between items-start gap-1">
                     <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span 
                            onClick={(e) => handleEditSerial(e, acc.name, acc.serial)}
                            title="Click to set custom order"
                            className={`text-sm font-bold w-10 h-10 shrink-0 rounded-xl border cursor-pointer inline-flex items-center justify-center hover:scale-105 transition-transform ${
                                acc.serial !== undefined 
                                   ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm' 
                                   : 'bg-transparent text-gray-500 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {acc.serial !== undefined ? acc.serial : index + 1}
                        </span>
                        <h3 className="min-w-0 font-bold text-base whitespace-normal break-words leading-relaxed text-slate-800 group-hover:text-indigo-700 transition-colors">{getTranslated(acc.name)}</h3>
                     </div>
                     <span className="shrink-0 text-xl text-indigo-300 group-hover:text-indigo-500">➔</span>
                  </div>
                  {activeTab === 'supplier' ? (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-3 rounded-xl bg-emerald-50/80 border border-emerald-100/80 px-3 py-3">
                        <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 sm:w-3.5 sm:h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold leading-relaxed text-emerald-700/80 break-words">{t.farmerPhoneLabel}</p>
                          <p className="text-base font-semibold text-slate-800 truncate mt-1">{acc.phone || '—'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-start gap-2 rounded-xl bg-amber-50/80 border border-amber-100/80 px-3 py-3">
                          <span className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 sm:w-3.5 sm:h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0-18c2.5 2 5 4.5 5 8.5S14.5 17 12 21c-2.5-4-5-6.5-5-9.5S9.5 5 12 3z" />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-relaxed text-amber-800/80 break-words">{t.farmerAcresLabel}</p>
                            <p className="text-base font-semibold text-slate-800 mt-1">{acc.acres != null ? acc.acres : '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-xl bg-sky-50/80 border border-sky-100/80 px-3 py-3">
                          <span className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 sm:w-3.5 sm:h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold leading-relaxed text-sky-800/80 break-words">{t.farmerDateCutterLabel}</p>
                            <p className="text-base font-semibold text-slate-800 mt-1 truncate">{acc.dateCutter ? formatDisplayDate(acc.dateCutter) : '—'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 sm:mt-2">
                        <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-semibold truncate">{t.accountBalance}</p>
                        <p className={`text-xs sm:text-lg font-bold tabular-nums break-all leading-tight ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                           ₹{formatIndianCurrency(acc.balance)}
                        </p>
                    </div>
                  )}
               </div>
               )
            ))}
            {accountList.length === 0 && (
               <div className="col-span-full text-center py-8 sm:py-10 text-gray-400 text-sm">
                  {t.noAccountsFound}
               </div>
            )}
         </div>

         {/* Removed accounts (recover) */}
         <div className="mt-8 border-t pt-5">
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-base font-bold text-gray-700">{t.removedAccountsTitle}</h3>
           </div>
           {removedAccounts.length === 0 || (!onRestoreAccount && !onDeleteRemovedAccount) ? (
             <div className="text-sm text-gray-400">{t.noRemovedAccounts}</div>
           ) : (
             <div className="grid grid-cols-1 gap-3">
               {removedAccounts.map((acc) => (
                 <div
                   key={`removed-${acc.name}`}
                   className="border rounded-xl p-4 bg-gray-50 flex items-center justify-between gap-3"
                 >
                   <div className="min-w-0">
                     <div className="font-bold text-base text-gray-800 truncate">{getTranslated(acc.name)}</div>
                     <div className="text-xs text-gray-500 uppercase font-semibold">
                       {acc.type}
                     </div>
                   </div>
                   <div className="shrink-0 flex items-center gap-2">
                     {onRestoreAccount && (
                       <button
                         type="button"
                         onClick={() => onRestoreAccount(acc.name)}
                         className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold shadow-sm transition"
                       >
                         {t.restoreAccountBtn}
                       </button>
                     )}
                     {onDeleteRemovedAccount && (
                       <button
                         type="button"
                         onClick={() => onDeleteRemovedAccount(acc.name)}
                         className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition"
                       >
                         {t.deleteRemovedAccountBtn}
                       </button>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
      </div>

      {/* --- ADD ACCOUNT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className={`bg-white rounded-lg p-4 sm:p-6 w-full shadow-xl transform transition-all animate-fade-in relative max-h-[92vh] overflow-y-auto ${
              activeTab === 'supplier' ? 'max-w-md max-h-[90vh] overflow-y-auto' : 'max-w-sm'
            }`}>
                <button
                  type="button"
                  onClick={onCancelAddAccount}
                  className="absolute top-3 right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition font-extrabold"
                  aria-label={t.cancelBtn}
                  title={t.cancelBtn}
                >
                  ✕
                </button>
                <h3 className="text-xl font-bold mb-2">{t.createAccountTitle}</h3>
                <p className="mb-4 text-sm text-gray-600">
                    {activeTab === 'labour' ? t.creatingLabourAccount : 
                    (activeTab === 'customer' ? t.creatingCustomerAccount : 
                    (activeTab === 'supplier' ? t.creatingSupplierAccount : t.creatingPartnerAccount))}
                </p>
                
                <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t.nameLabel}</label>
                    <input 
                        autoFocus
                        type="text"
                        className={`w-full px-3 py-2 border rounded-lg uppercase focus:ring-2 focus:outline-none ${accountErrors ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-blue-500 border-gray-300'}`}
                        placeholder={t.enterAccountName}
                        value={newAccountName}
                        onChange={e => { onNewAccountNameChange(e.target.value.toUpperCase()); setAccountErrors(''); }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          handleConfirmAddAccountClick();
                        }}
                    />
                    {accountErrors && <p className="text-red-500 text-xs mt-1">{accountErrors}</p>}
                </div>

                {/* Optional Rate Field only for Labour */}
                {activeTab === 'labour' && (
                    <>
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t.labourWageLabel}</label>
                        <input 
                            type="text"
                            inputMode="numeric"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none border-gray-300"
                            placeholder="400"
                            value={newAccountRate}
                            onChange={e => onNewAccountRateChange(formatInputCurrency(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              handleConfirmAddAccountClick();
                            }}
                        />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerPhoneLabel}</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none ${accountErrors && activeTab === 'labour' ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="98765 43210"
                        value={newLabourPhone}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                          const formatted = digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
                          onNewLabourPhoneChange?.(formatted);
                          setAccountErrors('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          e.preventDefault();
                          handleConfirmAddAccountClick();
                        }}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">10 digits required</p>
                    </div>
                    </>
                )}

                {activeTab === 'customer' && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerPhoneLabel}</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none ${accountErrors ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="98765 43210"
                      value={newCustomerPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                        onNewCustomerPhoneChange?.(digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits);
                        setAccountErrors('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        handleConfirmAddAccountClick();
                      }}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">10 digits required</p>
                  </div>
                )}

                {/* Farmer profile fields */}
                {activeTab === 'supplier' && (
                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerPhoneLabel}</label>
                      <input
                        type="tel"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="e.g. 98765 43210"
                        value={newFarmerPhone}
                        onChange={e => onNewFarmerPhoneChange?.(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerAddressLabel}</label>
                      <textarea
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-y"
                        rows={2}
                        placeholder="Village / City / Road"
                        value={newFarmerAddress}
                        onChange={e => onNewFarmerAddressChange?.(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">{t.farmerAcresLabel}</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        placeholder="e.g. 5.5"
                        value={newFarmerAcres}
                        onChange={e => onNewFarmerAcresChange?.(e.target.value.replace(/[^\d.]/g, ''))}
                      />
                    </div>
                    <div>
                      <DateInput
                        label={t.farmerDateCutterLabel}
                        value={newFarmerDateCutter}
                        onChange={d => onNewFarmerDateCutterChange?.(d)}
                      />
                    </div>
                  </div>
                )}

                <button 
                    onClick={handleConfirmAddAccountClick} 
                    className={`w-full py-2.5 rounded-xl font-semibold transition shadow-sm ${
                      activeTab === 'labour'
                        ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-amber-400/30'
                        : activeTab === 'partner'
                        ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/30'
                        : activeTab === 'customer'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30'
                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/30'
                    }`}
                >
                    {t.createBtn}
                </button>
            </div>
        </div>
      )}
      {isAccountOnlyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in max-h-[92vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-gray-800">{t.receiveRefundBtn}</h3>
            <form onSubmit={submitAccountOnlyReceived}>
              <div className="mb-4">
                <DateInput
                  label={t.dateHeader}
                  value={accountOnlyForm.date}
                  onChange={(d) => {
                    setAccountOnlyForm({ ...accountOnlyForm, date: d });
                    if (accountOnlyErrors.date) setAccountOnlyErrors({});
                  }}
                />
                {accountOnlyErrors.date && <p className="text-red-500 text-xs mt-1">{accountOnlyErrors.date}</p>}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.amountHeader}</label>
                <input
                  autoFocus
                  type="number"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                    accountOnlyErrors.amount ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-green-500 border-gray-300'
                  }`}
                  placeholder="0"
                  value={accountOnlyForm.amount}
                  onChange={(e) => {
                    setAccountOnlyForm({ ...accountOnlyForm, amount: e.target.value });
                    if (accountOnlyErrors.amount) setAccountOnlyErrors({});
                  }}
                />
                {accountOnlyErrors.amount && <p className="text-red-500 text-xs mt-1">{accountOnlyErrors.amount}</p>}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1">{t.detailsLabel}</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none border-gray-300"
                  value={accountOnlyForm.note}
                  onChange={(e) => setAccountOnlyForm({ ...accountOnlyForm, note: e.target.value })}
                  placeholder={t.detailsHeader}
                />
              </div>

              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold transition">
                  {t.submitBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccountOnlyModalOpen(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-bold transition"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {serialModal}
      {renameModal}
    </div>
  );
};
