

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
    <div className="space-y-6 animate-fade-in">
        
        {/* Filters and Header */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
             <div className="flex justify-between items-start mb-6">
                 <h2 className="text-2xl font-bold text-gray-800">{t.reportAllTransactionsTitle}</h2>
                 <button 
                     onClick={onDownloadPdf}
                     className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-lg font-bold shadow-md transition flex items-center gap-2"
                 >
                     <span>📄</span> {t.downloadPdfBtn}
                 </button>
             </div>
             
             <div className="flex flex-col md:flex-row gap-6 items-end">
                  {/* Date Filter */}
                  <div className="flex gap-4 w-full md:w-auto">
                      <div className="w-1/2 md:w-48">
                           <DateInput 
                              label={t.fromDateLabel}
                              value={startDate}
                              onChange={onStartDateChange}
                           />
                      </div>
                      <div className="w-1/2 md:w-48">
                           <DateInput 
                              label={t.toDateLabel}
                              value={endDate}
                              onChange={onEndDateChange}
                           />
                      </div>
                  </div>

                  {/* Type Filter */}
                  <div className="w-full md:w-64">
                       <label className="block text-sm font-semibold text-gray-700 mb-1">{t.filterTypeLabel}</label>
                       <select 
                          value={filterType}
                          onChange={(e) => onFilterTypeChange(e.target.value as any)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                       >
                           <option value="all">{t.filterAll}</option>
                           <option value="income">{t.filterIncome}</option>
                           <option value="expense">{t.filterExpense}</option>
                       </select>
                  </div>
             </div>
        </div>

        {/* Summary Cards for Selected Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-green-50 p-5 rounded-lg border border-green-100 shadow-sm">
                 <p className="text-xs uppercase font-bold text-green-600 mb-1">{t.reportTotalIncome}</p>
                 <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(totalIncome)}</p>
             </div>
             <div className="bg-red-50 p-5 rounded-lg border border-red-100 shadow-sm">
                 <p className="text-xs uppercase font-bold text-red-500 mb-1">{t.reportTotalExpense}</p>
                 <p className="text-3xl font-bold text-gray-800">₹{formatIndianCurrency(totalExpense)}</p>
             </div>
             <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                 <p className="text-xs uppercase font-bold text-gray-500 mb-1">{t.reportNet}</p>
                 <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                     ₹{formatIndianCurrency(netBalance)}
                 </p>
             </div>
        </div>

        {/* Transaction Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
             <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                     <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b">
                         <tr>
                             <th className="px-6 py-4">{t.dateHeader}</th>
                             <th className="px-6 py-4">{t.nameLabel}</th>
                             <th className="px-6 py-4">{t.detailsHeader}</th>
                             <th className="px-6 py-4">{t.typeHeader}</th>
                             <th className="px-6 py-4">{t.incomeTypeHeader} / {t.expenseTypeHeader}</th>
                             <th className="px-6 py-4 text-right">{t.amountHeader}</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {filteredTransactions.map(tr => (
                             <tr key={tr.id} className="hover:bg-gray-50 transition-colors">
                                 <td className="px-6 py-4 text-gray-600 whitespace-nowrap font-medium">
                                     {formatDisplayDate(tr.date)}
                                 </td>
                                 <td className="px-6 py-4">
                                     <span className="font-bold text-gray-800">{getTranslated(tr.accountName) || '-'}</span>
                                 </td>
                                 <td className="px-6 py-4 text-gray-600 max-w-xs truncate">
                                     {getTranslated(tr.details) || '-'}
                                 </td>
                                 <td className="px-6 py-4">
                                     <span className={`px-2 py-1 rounded text-xs font-bold ${tr.paymentType === 'cash' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                                         {tr.paymentType.toUpperCase()}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4">
                                     <span className={`px-2 py-1 rounded text-xs font-bold ${tr.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                         {tr.category.toUpperCase()}
                                     </span>
                                 </td>
                                 <td className={`px-6 py-4 text-right font-bold text-lg ${tr.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                     {tr.type === 'income' ? '+' : '-'} ₹{formatIndianCurrency(tr.amount)}
                                 </td>
                             </tr>
                         ))}
                         {filteredTransactions.length === 0 && (
                             <tr>
                                 <td colSpan={6} className="p-12 text-center text-gray-400 italic text-lg">
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