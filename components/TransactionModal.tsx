

import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Translation, StoredAccount } from '../types';
import { formatInputCurrency, parseCurrency } from '../utils';
import { DateInput } from './DateInput';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (t: Omit<Transaction, 'id' | 'timestamp'>, endDate?: string) => void;
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
  const [category, setCategory] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [amountStr, setAmountStr] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('cash');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Range Logic
  const [isRange, setIsRange] = useState(false);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

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
      if (initialData) {
        setCategory(initialData.category);
        setAccountName(initialData.accountName || '');
        setDetails(initialData.details || '');
        setAmountStr(formatInputCurrency(initialData.amount.toString()));
        setPaymentType(initialData.paymentType);
        setDate(initialData.date);
        setIsRange(false);
        setEndDate(initialData.date);
        setIsManualEntry(false);
      } else {
        // Defaults
        if (mode === 'income') {
          setCategory(defaultCategory || 'customer');
        } else {
          setCategory(defaultCategory || 'shop');
        }
        
        setAccountName(defaultAccountName || '');
        setDetails('');
        setAmountStr('');
        setPaymentType('cash');
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setEndDate(today);
        setIsRange(false);
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

  if (!isOpen) return null;

  const validate = () => {
      const newErrors: Record<string, string> = {};
      const amount = parseCurrency(amountStr);
      
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

      if (isRange && endDate < date) {
          newErrors.dateRange = t.alertDateOrder;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
        // Shake logic or focus could go here
        return;
    }

    onSubmit({
      type: mode,
      category,
      accountName: accountName.trim(), 
      details,
      amount: parseCurrency(amountStr),
      paymentType: paymentType as any,
      date,
    }, isRange ? endDate : undefined);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl transform transition-all overflow-y-auto max-h-[90vh]">
        <h3 className={`text-2xl font-bold mb-4 ${mode === 'income' ? 'text-green-600' : 'text-red-600'}`}>
          {initialData 
            ? (mode === 'income' ? t.editIncomeTitle : t.editExpenseTitle)
            : (mode === 'income' ? t.addIncomeTitle : t.addExpenseTitle)
          }
        </h3>
        
        <form onSubmit={handleSubmit}>
          
          {/* Date & Range Selection */}
          <div className="mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
             <div className="mb-2">
                <DateInput 
                    label={`${t.transactionDateLabel} ${isRange ? "(Start)" : ""}`}
                    value={date}
                    onChange={setDate}
                />
             </div>
             
             {!initialData && (
                 <div className="flex items-center mt-2 mb-2">
                    <input 
                        type="checkbox" 
                        id="enableRange"
                        checked={isRange}
                        onChange={(e) => setIsRange(e.target.checked)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded border-gray-300"
                    />
                    <label htmlFor="enableRange" className="ml-2 text-sm text-gray-700 font-medium cursor-pointer">
                        {t.enableDateRange}
                    </label>
                 </div>
             )}

             {isRange && !initialData && (
                 <div className="mt-2 animate-fade-in">
                    <DateInput 
                        label={t.rangeEndDateLabel}
                        value={endDate}
                        onChange={(d) => {
                            setEndDate(d);
                            if (errors.dateRange) setErrors(prev => ({ ...prev, dateRange: '' }));
                        }}
                        min={date}
                        className={errors.dateRange ? "border-red-500" : ""}
                    />
                    {errors.dateRange && <p className="text-red-500 text-xs mt-1">{errors.dateRange}</p>}
                    <p className="text-xs text-gray-500 mt-1 italic">
                        {t.rangeHelpText}
                    </p>
                 </div>
             )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {mode === 'income' ? t.incomeTypeLabel : t.expenseTypeHeader}
            </label>
            <select 
              value={category} 
              onChange={e => {
                  setCategory(e.target.value);
                  setAccountName(''); // Reset account when category changes
                  setIsManualEntry(false);
              }}
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
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
                  <option value="shop">{t.shopOption}</option>
                  <option value="oil">{t.oilOption}</option>
                  <option value="electricity">{t.electricityOption}</option>
                  <option value="labour">{t.labourOption}</option>
                  <option value="partner">{t.partnerOption}</option>
                  <option value="customer">{t.customerOption}</option>
                  <option value="supplier">{t.supplierOption}</option>
                  <option value="custom">{t.customOption}</option>
                  {/* Cash Conversion Option - Only available in Expense mode */}
                  <option value="cash_conversion" className="font-bold text-blue-600">{t.cashConversionOption}</option>
                </>
              )}
            </select>
          </div>

          {showAccountSelect && (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
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
                              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none ${errors.accountName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
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
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none ${errors.accountName ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
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
          <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t.detailsLabel} <span className="text-gray-400 font-normal text-xs">(Optional)</span>
              </label>
              <input 
                type="text" 
                value={details}
                onChange={e => setDetails(e.target.value)}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
              />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t.amountLabel}</label>
            <input 
              type="text" 
              value={amountStr}
              onChange={handleAmountChange}
              placeholder="0"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:outline-none ${errors.amount ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'}`}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t.paymentLabel}</label>
            <select 
              value={paymentType}
              onChange={e => setPaymentType(e.target.value)}
              disabled={isCashConversion} // Lock selection if conversion
              className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:outline-none ${mode === 'income' ? 'focus:ring-green-500' : 'focus:ring-red-500'} ${isCashConversion ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            >
              {/* If conversion, only show Online/Bank as source options */}
              {isCashConversion ? (
                 <>
                    <option value="online">{t.onlineOption}</option>
                    <option value="bank">{t.bankOption}</option>
                 </>
              ) : (
                 <>
                    <option value="cash">{t.cashOption}</option>
                    <option value="online">{t.onlineOption}</option>
                    <option value="bank">{t.bankOption}</option>
                 </>
              )}
            </select>
          </div>

          <div className="flex gap-2">
            <button 
              type="submit" 
              className={`flex-1 text-white px-4 py-2 rounded-lg font-semibold transition ${mode === 'income' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {initialData ? t.updateBtn : t.submitBtn}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold transition"
            >
              {t.cancelBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};