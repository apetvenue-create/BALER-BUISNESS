

import React from 'react';
import { Translation, Transaction } from '../../types';
import { formatIndianCurrency, formatDisplayDate } from '../../utils';
import { DateInput } from '../../components/DateInput';

interface ReportsPageViewProps {
  t: Translation;
  filteredTransactions: Transaction[];
  startDate: string;
  onStartDateChange: (d: string) => void;
  endDate: string;
  onEndDateChange: (d: string) => void;
  filterType: 'all' | 'income' | 'expense';
  onFilterTypeChange: (type: 'all' | 'income' | 'expense') => void;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  getTranslated: (text?: string) => string;
  onDownloadPdf: () => void; // New prop
}

export const ReportsPageView: React.FC<ReportsPageViewProps> = ({
  t,
  filteredTransactions,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  filterType,
  onFilterTypeChange,
  totalIncome,
  totalExpense,
  netBalance,
  getTranslated,
  onDownloadPdf
}) => {
  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
        
        {/* Filters and Header */}
        <div className="bg-white rounded-lg shadow-md px-3 py-3 sm:p-6 border-l-4 border-indigo-500">
             <div className="flex justify-between items-start gap-2 mb-2 sm:mb-4 md:mb-6">
                 <h2 className="text-sm sm:text-lg md:text-2xl font-bold text-gray-800 leading-tight">{t.reportAllTransactionsTitle}</h2>
                 <button 
                     onClick={onDownloadPdf}
                     className="bg-gray-800 hover:bg-black text-white px-2 py-1 sm:px-4 sm:py-2 rounded-lg font-bold shadow-md text-[11px] sm:text-sm transition flex items-center gap-1 shrink-0"
                 >
                     <span>📄</span> <span className="hidden sm:inline">{t.downloadPdfBtn}</span><span className="sm:hidden">PDF</span>
                 </button>
             </div>
             
             <div className="flex flex-col gap-2 sm:gap-4 md:flex-row md:gap-6 md:items-end">
                  <div className="flex gap-2 sm:gap-4 w-full md:w-auto">
                      <div className="flex-1 md:w-48">
                           <DateInput 
                              label={t.fromDateLabel}
                              value={startDate}
                              onChange={onStartDateChange}
                           />
                      </div>
                      <div className="flex-1 md:w-48">
                           <DateInput 
                              label={t.toDateLabel}
                              value={endDate}
                              onChange={onEndDateChange}
                           />
                      </div>
                  </div>

                  <div className="w-full md:w-64">
                       <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-0.5 sm:mb-1">{t.filterTypeLabel}</label>
                       <select 
                          value={filterType}
                          onChange={(e) => onFilterTypeChange(e.target.value as any)}
                          className="w-full px-2 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm focus:outline-none"
                       >
                           <option value="all">{t.filterAll}</option>
                           <option value="income">{t.filterIncome}</option>
                           <option value="expense">{t.filterExpense}</option>
                       </select>
                  </div>
             </div>
        </div>

        {/* Summary Cards for Selected Range */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
             <div className="bg-green-50 px-2 py-2.5 sm:p-4 md:p-5 rounded-lg border border-green-100 shadow-sm text-center sm:text-left">
                 <p className="text-[10px] sm:text-xs uppercase font-bold text-green-600 mb-0.5 sm:mb-1 truncate">{t.reportTotalIncome}</p>
                 <p className="text-sm sm:text-xl md:text-3xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(totalIncome)}</p>
             </div>
             <div className="bg-red-50 px-2 py-2.5 sm:p-4 md:p-5 rounded-lg border border-red-100 shadow-sm text-center sm:text-left">
                 <p className="text-[10px] sm:text-xs uppercase font-bold text-red-500 mb-0.5 sm:mb-1 truncate">{t.reportTotalExpense}</p>
                 <p className="text-sm sm:text-xl md:text-3xl font-bold text-gray-800 tabular-nums break-all">₹{formatIndianCurrency(totalExpense)}</p>
             </div>
             <div className="bg-white px-2 py-2.5 sm:p-4 md:p-5 rounded-lg border border-gray-200 shadow-sm text-center sm:text-left">
                 <p className="text-[10px] sm:text-xs uppercase font-bold text-gray-500 mb-0.5 sm:mb-1 truncate">{t.reportNet}</p>
                 <p className={`text-sm sm:text-xl md:text-3xl font-bold tabular-nums break-all ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                     ₹{formatIndianCurrency(netBalance)}
                 </p>
             </div>
        </div>

        {/* Transaction Records */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
             {/* Mobile cards */}
             <div className="md:hidden divide-y divide-gray-100">
                 {filteredTransactions.length === 0 ? (
                     <p className="px-3 py-8 text-center text-gray-400 italic text-sm">{t.noRecords}</p>
                 ) : (
                     filteredTransactions.map(tr => (
                         <article key={tr.id} className="px-2.5 py-2.5">
                             <div className="flex items-start justify-between gap-2 mb-1">
                                 <div className="min-w-0 flex-1">
                                     <div className="flex items-baseline gap-1.5 min-w-0">
                                         <p className="text-sm font-bold text-gray-800 truncate">{getTranslated(tr.accountName) || '—'}</p>
                                         <p className="text-[10px] font-semibold text-gray-400 tabular-nums shrink-0">{formatDisplayDate(tr.date)}</p>
                                     </div>
                                     {getTranslated(tr.details) && (
                                         <p className="text-[10px] text-gray-500 truncate mt-0.5">{getTranslated(tr.details)}</p>
                                     )}
                                 </div>
                                 <p className={`shrink-0 text-sm font-extrabold tabular-nums ${tr.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                     {tr.type === 'income' ? '+' : '-'}₹{formatIndianCurrency(tr.amount)}
                                 </p>
                             </div>
                             <div className="flex flex-wrap items-center gap-1">
                                 <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                     {tr.paymentType}
                                 </span>
                                 <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tr.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                     {tr.category}
                                 </span>
                             </div>
                         </article>
                     ))
                 )}
             </div>

             {/* Desktop table */}
             <div className="hidden md:block overflow-x-auto">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b">
                         <tr>
                             <th className="px-3 py-2 sm:px-6 sm:py-4">{t.dateHeader}</th>
                             <th className="px-3 py-2 sm:px-6 sm:py-4">{t.nameLabel}</th>
                             <th className="px-3 py-2 sm:px-6 sm:py-4">{t.detailsHeader}</th>
                             <th className="px-3 py-2 sm:px-6 sm:py-4">{t.typeHeader}</th>
                             <th className="px-3 py-2 sm:px-6 sm:py-4">{t.incomeTypeHeader} / {t.expenseTypeHeader}</th>
                             <th className="px-3 py-2 sm:px-6 sm:py-4 text-right">{t.amountHeader}</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {filteredTransactions.map(tr => (
                             <tr key={tr.id} className="hover:bg-gray-50 transition-colors">
                                 <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-600 whitespace-nowrap font-medium">
                                     {formatDisplayDate(tr.date)}
                                 </td>
                                 <td className="px-3 py-2 sm:px-6 sm:py-4">
                                     <span className="font-bold text-gray-800">{getTranslated(tr.accountName) || '-'}</span>
                                 </td>
                                 <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-600 max-w-xs truncate">
                                     {getTranslated(tr.details) || '-'}
                                 </td>
                                 <td className="px-3 py-2 sm:px-6 sm:py-4">
                                     <span className={`px-2 py-1 rounded text-xs font-bold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                         {tr.paymentType.toUpperCase()}
                                     </span>
                                 </td>
                                 <td className="px-3 py-2 sm:px-6 sm:py-4">
                                     <span className={`px-2 py-1 rounded text-xs font-bold ${tr.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                         {tr.category.toUpperCase()}
                                     </span>
                                 </td>
                                 <td className={`px-3 py-2 sm:px-6 sm:py-4 text-right font-bold text-base sm:text-lg ${tr.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                     {tr.type === 'income' ? '+' : '-'} ₹{formatIndianCurrency(tr.amount)}
                                 </td>
                             </tr>
                         ))}
                         {filteredTransactions.length === 0 && (
                             <tr>
                                 <td colSpan={6} className="p-6 sm:p-12 text-center text-gray-400 italic text-sm sm:text-lg">
                                     {t.noRecords}
                                 </td>
                             </tr>
                         )}
                     </tbody>
                 </table>
             </div>
        </div>

    </div>
  );
};