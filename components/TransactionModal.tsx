

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Translation, StoredAccount } from '../types';
import { formatInputCurrency, parseCurrency } from '../utils';
import { DateInput } from './DateInput';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (t: Omit<Transaction, 'id' | 'timestamp'>) => void;
  initialData?: Transaction | null;
  mode: TransactionType;
  t: Translation;
  availableAccounts: StoredAccount[];
  // New props for pre-filling
  defaultCategory?: string;
  defaultAccountName?: string;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  t,
  availableAccounts,
  defaultCategory,
  defaultAccountName
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);
  const isSubmittingRef = useRef(false);
  const [category, setCategory] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('online');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // UI State for Manual Account Entry
  const [isManualEntry, setIsManualEntry] = useState(false);

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Flag for Cash Conversion
  const isCashConversion = category === 'cash_conversion';

  // Derived: Filter accounts based on selected category
  const filteredAccounts = useMemo(() => {
    if (!category || isCashConversion) return [];
    
    // Map Category to Account Type logic
    let targetType: string | null = null;
    if (category === 'labour') targetType = 'labour';
    if (category === 'partner') targetType = 'partner';
    if (category === 'customer') targetType = 'customer';
    if (category === 'supplier') targetType = 'supplier';
    
    // If category has a specific type map, filter. Otherwise show all (or none if shop)
    if (targetType) {
        return availableAccounts.filter(acc => acc.type === targetType);
    }
    
    // Fallback: If it's a generic category that implies an account might be used
    return availableAccounts;
  }, [category, availableAccounts, isCashConversion]);

  useEffect(() => {
    if (isOpen) {
      setErrors({}); // Clear errors on open
      isSubmittingRef.current = false; // Reset submit lock each open
      if (initialData) {
        setCategory(initialData.category);
        setAccountName(initialData.accountName || '');
        setDetails(initialData.details || '');
        setAmountStr(formatInputCurrency(initialData.amount.toString()));
        setPaymentType(initialData.paymentType);
        setDate(initialData.date);
        setIsManualEntry(false);
      } else {
        // Defaults
        if (mode === 'income') {
          setCategory(defaultCategory || 'customer');
        } else {
          setCategory(defaultCategory || 'oil');
        }
        
        setAccountName(defaultAccountName || '');
        setDetails('');
        setAmountStr('');
        setPaymentType('online');
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setIsManualEntry(false);
      }
    }
  }, [isOpen, initialData, mode, defaultCategory, defaultAccountName]);

  // Effect to handle Cash Conversion Logic
  useEffect(() => {
    if (isCashConversion) {
      setPaymentType('online'); // Default source is Online for conversion
      setAccountName(''); // No specific account
    }
  }, [isCashConversion]);

  // Enter should save reliably every time while modal is open.
  // Using a window listener avoids edge cases where the focused element swallows Enter.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (e.repeat) return;
      if (isSubmittingRef.current) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'textarea' || tag === 'select') return;
      if ((target as any)?.isContentEditable) return;

      e.preventDefault();
      formRef.current?.requestSubmit();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen]);

  if (!isOpen) return null;

  const validate = () => {
      const newErrors: Record<string, string> = {};
      const amount = parseCurrency(amountStr);
      
      if (!category || !category.trim()) {
          newErrors.category = t.errRequired;
      }

      if (!amount || amount <= 0) {
          newErrors.amount = t.alertAmountRequired;
      }

      // Account Name Validation for specific categories
      const requiresAccount = !isCashConversion && (category === 'customer' || category === 'partner' || category === 'labour' || category === 'supplier');
      
      if (requiresAccount) {
          if (!accountName || !accountName.trim()) {
              newErrors.accountName = isManualEntry ? t.errRequired : t.errAccountRequired;
          } else if (accountName === '__new__') {
              newErrors.accountName = t.errAccountRequired;
          }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    
    if (!validate()) {
        // Shake logic or focus could go here
        isSubmittingRef.current = false;
        return;
    }

    const normalizedCategory = category;
    const normalizedDetails =
      category === 'cl_oil'
        ? (details && details.trim() ? `CL OIL - ${details.trim()}` : 'CL OIL')
        : details;

    onSubmit({
      type: mode,
      category: normalizedCategory,
      accountName: accountName.trim(), 
      details: normalizedDetails,
      amount: parseCurrency(amountStr),
      paymentType: paymentType as any,
      date,
    });
    onClose();
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
        setIsManualEntry(true);
        setAccountName('');
    } else {
        setAccountName(val);
    }
    // Clear error on change
    if (errors.accountName) setErrors(prev => ({ ...prev, accountName: '' }));
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatInputCurrency(e.target.value);
    setAmountStr(formatted);
    if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }));
  };

  // Determine if the account selector should be visible
  const showAccountSelect = 
    !isCashConversion && (
      mode === 'income' || 
      ['labour', 'partner', 'customer', 'supplier', 'other_income'].includes(category)
    );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-xl transform transition-all relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-full w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition font-extrabold"
          aria-label={t.cancelBtn}
          title={t.cancelBtn}
        >
          ✕
        </button>

        {/* Scrollable content (close button stays fixed) */}
        <div className="p-4 sm:p-6">
          <h3 className={`text-lg sm:text-2xl font-bold mb-3 sm:mb-4 pr-10 ${mode === 'income' ? 'text-green-600' : 'text-red-600'}`}>
            {initialData 
              ? (mode === 'income' ? t.editIncomeTitle : t.editExpenseTitle)
              : (mode === 'income' ? t.addIncomeTitle : t.addExpenseTitle)
            }
          </h3>
          
          <form
            ref={formRef}
            onSubmit={handleSubmit}
          >
            
            {/* Date Selection */}
            <div className="mb-3 sm:mb-4">
               <DateInput 
                   value={date}
                   onChange={setDate}
               />
            </div>

            <div className="mb-3 sm:mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
                {mode === 'income' ? t.incomeTypeLabel : t.expenseTypeHeader}
              </label>
              <select 
                value={category} 
                onChange={e => {
                    setCategory(e.target.value);
                    setAccountName(''); // Reset account when category changes
                    setIsManualEntry(false);
                }}
                className={`w-full px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
              >
                {mode === 'income' ? (
                  <>
                    <option value="customer">{t.customerOption}</option>
                    <option value="partner">{t.partnerOption}</option>
                    {/* Only show Supplier in Income if specifically editing/adding a refund via Account Page */}
                    {(category === 'supplier' || defaultCategory === 'supplier') && (
                        <option value="supplier">{t.supplierOption}</option>
                    )}

                    <option value="other_income">{t.otherIncomeOption}</option>
                  </>
                ) : (
                  <>
                    {(category === 'shop' || defaultCategory === 'shop') && (
                      <option value="shop">{t.shopOption}</option>
                    )}
                    <option value="oil">{t.oilOption}</option>
                    {(category === 'cl_oil' || defaultCategory === 'cl_oil') && (
                      <option value="cl_oil">{t.clOilOption}</option>
                    )}
                    <option value="electricity">{t.electricityOption}</option>
                    <option value="food">{t.foodOption}</option>
                    <option value="labour">{t.labourOption}</option>
                    <option value="partner">{t.partnerOption}</option>
                    {(category === 'customer' || defaultCategory === 'customer') && (
                      <option value="customer">{t.customerOption}</option>
                    )}
                    {(category === 'supplier' || defaultCategory === 'supplier') && (
                      <option value="supplier">{t.supplierOption}</option>
                    )}

                    <option value="custom">{t.customOption}</option>
                    {/* Cash Conversion Option - Only available in Expense mode */}
                    <option value="cash_conversion" className="font-bold text-blue-600">{t.cashConversionOption}</option>
                  </>
                )}
              </select>
            </div>

          {showAccountSelect && (
            <div className="mb-3 sm:mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
                {mode === 'income' ? t.selectAccountLabel : t.selectPersonLabel}
              </label>
              
              {isManualEntry ? (
                  <div className="flex gap-2">
                      <div className="flex-1">
                          <input 
                              autoFocus
                              type="text"
                              value={accountName}
                              onChange={e => {
                                  setAccountName(e.target.value);
                                  if (errors.accountName) setErrors(prev => ({...prev, accountName: ''}));
                              }}
                              placeholder={t.enterAccountName}
                              className={`w-full px-3 py-1.5 sm:px-4 sm:py-2 border rounded-lg focus:ring-2 focus:outline-none ${errors.accountName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
                          />
                          {errors.accountName && <p className="text-red-500 text-xs mt-1">{errors.accountName}</p>}
                      </div>
                      <button 
                          type="button"
                          onClick={() => {
                              setIsManualEntry(false);
                              setAccountName('');
                              setErrors(prev => ({...prev, accountName: ''}));
                          }}
                          className="bg-gray-200 text-gray-600 px-3 rounded-lg hover:bg-gray-300 font-bold h-[42px]"
                          title="Cancel"
                      >
                          ✕
                      </button>
                  </div>
              ) : (
                  <div>
                      <select 
                        value={accountName}
                        onChange={handleAccountChange}
                        className={`w-full px-3 py-1.5 sm:px-4 sm:py-2 border rounded-lg focus:ring-2 focus:outline-none ${errors.accountName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
                      >
                        <option value="">{t.selectAccountPlaceholder}</option>
                        
                        {/* Render filtered accounts from state */}
                        {filteredAccounts.map(acc => (
                          <option key={acc.name} value={acc.name}>{acc.name}</option>
                        ))}
                        
                        {/* Fallback: if editing and account name is not in list (legacy), show it */}
                        {accountName && !filteredAccounts.some(a => a.name === accountName) && accountName !== '__new__' && (
                            <option value={accountName}>{accountName}</option>
                        )}
                        
                        <option value="__new__" className="font-bold text-blue-600">{t.addNewAccount}</option>
                      </select>
                      {errors.accountName && <p className="text-red-500 text-xs mt-1">{errors.accountName}</p>}
                  </div>
              )}
            </div>
          )}

          {/* Details Field */}
          <div className="mb-3 sm:mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1 sm:mb-2">
                {t.detailsLabel} <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <input 
                type="text" 
                value={details}
                onChange={e => setDetails(e.target.value)}
                className={`w-full px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
              />
          </div>

          <div className="mb-3 sm:mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1 sm:mb-2">{t.amountLabel}</label>
            <input 
              type="text" 
              value={amountStr}
              onChange={handleAmountChange}
              placeholder="0"
              className={`w-full px-3 py-1.5 sm:px-4 sm:py-2 border rounded-lg focus:ring-2 focus:outline-none ${errors.amount ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div className="mb-3 sm:mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1 sm:mb-2">{t.paymentLabel}</label>
            <select 
              value={paymentType}
              onChange={e => setPaymentType(e.target.value)}
              disabled={isCashConversion} // Lock selection if conversion
              className={`w-full px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'} ${isCashConversion ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              {/* If conversion, only show Online/Bank as source options */}
              {isCashConversion ? (
                 <>
                    <option value="online">{t.onlineOption}</option>
                 </>
              ) : (
                 <>
                    <option value="cash">{t.cashOption}</option>
                    <option value="online">{t.onlineOption}</option>
                 </>
              )}
            </select>
          </div>

            <div className="flex">
              <button 
                type="submit" 
                className={`w-full text-white px-4 py-2 sm:py-2.5 rounded-lg font-semibold text-sm sm:text-base transition ${mode === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {initialData ? t.updateBtn : t.submitBtn}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};