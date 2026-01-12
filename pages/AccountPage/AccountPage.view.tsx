

import React, { useState } from 'react';
import { Translation, PartnerSummary, LabourSummary, AccountTab, CustomerSummary, SupplierSummary, Transaction, Language, ManualAdjustment } from '../../types';
import { formatIndianCurrency, formatDisplayDate } from '../../utils';
import { TransactionModal } from '../../components/TransactionModal'; 
import { DateInput } from '../../components/DateInput';

interface AccountPageViewProps {
  t: Translation;
  activeTab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  // List Mode
  accountList: { name: string; balance: number }[]; 
  onAccountSelect: (name: string) => void;
  // Detail Mode
  selectedAccountName: string | null;
  onBack: () => void;
  partnerData?: PartnerSummary;
  labourData?: LabourSummary;
  customerData?: CustomerSummary;
  supplierData?: SupplierSummary;
  
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

  // Attendance
  onToggleAttendance?: (date: string) => void;
  
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
  
  onOpenAddAccount,
  isAddModalOpen,
  newAccountName,
  onNewAccountNameChange,
  onConfirmAddAccount,
  onCancelAddAccount,
  
  newAccountRate,
  onNewAccountRateChange,
  onToggleAttendance,
  
  labourStartDate,
  setLabourStartDate,
  labourEndDate,
  setLabourEndDate,
  onToggleHisaab,
  onAddAdjustment,
  onUpdateAdjustment,
  onDeleteAdjustment,
  
  onPrevMonth,
  onNextMonth,
  onPayLabour,
  onReceiveRefund,
  onDownloadPdf,
  pdfLanguage,
  setPdfLanguage,
  reportStartDate,
  setReportStartDate,
  reportEndDate,
  setReportEndDate,
  getTranslated
}) => {
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
      const rawAmt = parseFloat(bonusForm.amount);
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
      setAccountErrors('');
      onConfirmAddAccount();
  };
  
  // -- Helper for Report Controls --
  const renderReportControls = () => (
      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-sm flex-wrap sm:flex-nowrap">
          <div className="w-32">
              <DateInput 
                  value={reportStartDate} 
                  onChange={setReportStartDate} 
                  placeholder="From"
                  className="text-xs"
              />
          </div>
          <span className="text-gray-400">➜</span>
          <div className="w-32">
              <DateInput 
                  value={reportEndDate} 
                  onChange={setReportEndDate} 
                  placeholder="To"
                  className="text-xs"
              />
          </div>
          
          <div className="border-l pl-2 ml-2 flex items-center gap-1">
              <select 
                  value={pdfLanguage}
                  onChange={(e) => setPdfLanguage(e.target.value as Language)}
                  className="bg-white border border-gray-300 rounded text-xs py-2 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-gray-700"
              >
                  <option value="en">EN</option>
                  <option value="hi">HI</option>
                  <option value="pa">PA</option>
              </select>
              <button 
                  onClick={onDownloadPdf} 
                  className="text-white bg-gray-800 hover:bg-black flex items-center gap-1 text-xs font-bold px-3 py-2 rounded shadow transition whitespace-nowrap"
                  title={t.downloadPdfBtn}
              >
                  📄 PDF
              </button>
          </div>
      </div>
  );

  // --- RENDER DETAIL VIEW IF SELECTED ---
  if (selectedAccountName) {
      if (activeTab === 'customer' && customerData) {
          return (
              <div className="animate-fade-in space-y-6">
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <button onClick={onBack} className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                                <span>←</span> {t.backToAccounts}
                            </button>
                        </div>
                        
                        <div className="flex gap-4 items-center flex-wrap">
                            {/* View Toggle */}
                            <div className="bg-gray-100 p-1 rounded-lg flex text-xs sm:text-sm font-bold">
                                <button 
                                    onClick={() => setCustomerViewMode('statement')}
                                    className={`px-3 py-2 rounded-md transition-all ${customerViewMode === 'statement' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                >
                                    📜 {t.viewStatement}
                                </button>
                                <button 
                                    onClick={() => setCustomerViewMode('details')}
                                    className={`px-3 py-2 rounded-md transition-all ${customerViewMode === 'details' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                >
                                    📦 {t.viewDetails}
                                </button>
                            </div>
                            
                            {/* PDF Controls */}
                            {renderReportControls()}
                        </div>
                   </div>

                   <h2 className="text-2xl font-bold text-gray-800 border-b pb-2 mb-4">{getTranslated(customerData.name)}</h2>

                   {/* --- SIMPLE STATEMENT VIEW --- */}
                   {customerViewMode === 'statement' && (
                       <div className="space-y-4">
                            {/* Summary Card */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">{t.transactionHistory}</h3>
                                <div className="grid grid-cols-2 gap-4">
                                     <div>
                                         <p className="text-xs text-gray-400">{t.totalDebit}</p>
                                         <p className="text-xl font-bold text-red-600">₹{formatIndianCurrency(customerData.totalBilled)}</p>
                                         
                                         <p className="text-xs text-gray-400 mt-2">{t.totalCredit}</p>
                                         <p className="text-xl font-bold text-green-600">₹{formatIndianCurrency(customerData.totalReceived)}</p>
                                     </div>
                                     <div className="text-right border-l pl-4 flex flex-col justify-center">
                                         <p className="text-sm text-gray-400 mb-1">{t.totalNetBalance}</p>
                                         <p className={`text-3xl font-bold ${customerData.balance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ₹{formatIndianCurrency(Math.abs(customerData.balance))}
                                         </p>
                                         <p className={`text-sm font-bold ${customerData.balance >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            Rs
                                         </p>
                                     </div>
                                </div>
                            </div>

                            {/* Statement Table */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
                       <div className="space-y-6">
                            {/* CUSTOMER SUMMARY CARDS */}
                            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="text-xs uppercase font-bold text-gray-500">{t.customerBalance}</div>
                                        <div className="text-right">
                                            <p className={`text-3xl font-bold ${customerData.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                ₹{formatIndianCurrency(customerData.balance)}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <p className="text-xs text-gray-500 uppercase font-bold mb-1">{t.customerTotalStock}</p>
                                            <p className="text-xl font-bold text-gray-800">
                                                {(customerData.totalStockKg / 100).toFixed(2)} Q
                                            </p>
                                            <p className="text-xs text-gray-400">({customerData.totalStockKg} KG)</p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                            <p className="text-xs text-red-500 uppercase font-bold mb-1">{t.customerTotalBilled}</p>
                                            <p className="text-xl font-bold text-gray-800">₹{formatIndianCurrency(customerData.totalBilled)}</p>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                            <p className="text-xs text-green-600 uppercase font-bold mb-1">{t.customerTotalReceived}</p>
                                            <p className="text-xl font-bold text-gray-800">₹{formatIndianCurrency(customerData.totalReceived)}</p>
                                        </div>
                                    </div>
                            </div>

                            {/* UNIFIED CUSTOMER LEDGER */}
                            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
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
                                                    {row.vehicleNumber && <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs font-bold mr-2 uppercase">{row.vehicleNumber}</span>}
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
              </div>
          );
      } else if (activeTab === 'supplier' && supplierData) {
          return (
              <div className="animate-fade-in space-y-6">
                  {/* HEADER & NAV */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                      <div className="flex items-center gap-4">
                          <button onClick={onBack} className="text-blue-600 hover:underline font-medium flex items-center gap-1">
                              <span>←</span> {t.backToAccounts}
                          </button>
                      </div>
                      
                      <div className="flex gap-4 items-center flex-wrap">
                          {renderReportControls()}
                          <button 
                             onClick={onReceiveRefund}
                             className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition"
                          >
                             {t.receiveRefundBtn}
                          </button>
                      </div>
                  </div>

                  {/* SUPPLIER SUMMARY CARD */}
                  <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                       <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                           <h2 className="text-2xl font-bold text-gray-800 mb-2 md:mb-0">{getTranslated(supplierData.name)}</h2>
                           <div className="text-right">
                               <p className="text-xs uppercase font-bold text-gray-500">{t.netPaidBalance}</p>
                               <div className="text-3xl font-bold text-gray-800">
                                   ₹{formatIndianCurrency(supplierData.netBalance)}
                               </div>
                               <p className="text-xs text-gray-400 italic mt-1">
                                   (Total Paid - Total Received)
                               </p>
                           </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 mt-6 border-t pt-4">
                           <div>
                               <p className="text-xs text-gray-500 uppercase font-bold">{t.totalPaidToSupplier}</p>
                               <p className="text-xl font-bold text-red-600">₹{formatIndianCurrency(supplierData.totalPaid)}</p>
                           </div>
                           <div className="text-right">
                               <p className="text-xs text-gray-500 uppercase font-bold">{t.totalReceivedFromSupplier}</p>
                               <p className="text-xl font-bold text-green-600">₹{formatIndianCurrency(supplierData.totalReceived)}</p>
                           </div>
                       </div>
                  </div>

                  {/* STRICT SUPPLIER LEDGER */}
                  <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                       <table className="w-full text-sm">
                           <thead className="bg-gray-100 text-gray-700 font-bold uppercase border-b">
                               <tr>
                                   <th className="px-4 py-3 text-left">{t.dateHeader}</th>
                                   <th className="px-4 py-3 text-left w-1/3">{t.detailsHeader}</th>
                                   <th className="px-4 py-3 text-right bg-red-50 text-red-700">{t.colPaymentMade}</th>
                                   <th className="px-4 py-3 text-right bg-green-50 text-green-700">{t.colRefundReceived}</th>
                                   <th className="px-4 py-3 text-right">{t.netPaidBalance}</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {supplierData.ledger.map(row => (
                                   <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                       <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">
                                           {formatDisplayDate(row.date)}
                                       </td>
                                       <td className="px-4 py-3 text-gray-600">
                                           {getTranslated(row.description)}
                                           <div className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                                               {row.debitAmount > 0 ? t.sourceExpense : t.sourceManual}
                                           </div>
                                       </td>
                                       <td className="px-4 py-3 text-right bg-red-50/30">
                                           {row.debitAmount > 0 ? (
                                               <span className="font-bold text-red-600">₹{formatIndianCurrency(row.debitAmount)}</span>
                                           ) : <span className="text-gray-300">-</span>}
                                       </td>
                                       <td className="px-4 py-3 text-right bg-green-50/30">
                                           {row.creditAmount > 0 ? (
                                               <span className="font-bold text-green-600">₹{formatIndianCurrency(row.creditAmount)}</span>
                                           ) : <span className="text-gray-300">-</span>}
                                       </td>
                                       <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                                           ₹{formatIndianCurrency(row.runningBalance)}
                                       </td>
                                   </tr>
                               ))}
                               {supplierData.ledger.length === 0 && (
                                   <tr><td colSpan={5} className="p-8 text-center text-gray-400">{t.noRecords}</td></tr>
                                )}
                           </tbody>
                       </table>
                  </div>
              </div>
          );
      } else if (activeTab === 'partner' && partnerData) {
        return (
          <div className="animate-fade-in space-y-4">
            <div className="flex justify-between items-center mb-2">
                <button onClick={onBack} className="text-blue-600 hover:underline font-medium">{t.backToAccounts}</button>
                {renderReportControls()}
            </div>
            
            {/* Partner Summary Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500">
              <div className="flex justify-between items-start">
                 <div>
                    <h2 className="text-3xl font-bold text-gray-800">{getTranslated(partnerData.name)}</h2>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded mt-2 inline-block">{t.partnerAccountLabel}</span>
                 </div>
                 <div className="text-right">
                    <p className="text-gray-500 text-sm">{t.netPosition}</p>
                    <p className={`text-2xl font-bold ${partnerData.netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ₹{formatIndianCurrency(Math.abs(partnerData.netBalance))} Rs
                    </p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                 <div className="bg-green-50 p-3 rounded">
                    <p className="text-xs text-gray-500">{t.moneyIn}</p>
                    <p className="font-bold text-green-700">₹{formatIndianCurrency(partnerData.totalIn)}</p>
                 </div>
                 <div className="bg-red-50 p-3 rounded">
                    <p className="text-xs text-gray-500">{t.moneyOut}</p>
                    <p className="font-bold text-red-700">₹{formatIndianCurrency(partnerData.totalOut)}</p>
                 </div>
              </div>
            </div>

            {/* Split View */}
            <div className="flex flex-col md:flex-row gap-4 h-[600px]">
               {/* LEFT: IN */}
               <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col">
                  <div className="p-3 bg-green-100 border-b border-green-200 font-bold text-green-800 sticky top-0">
                     {t.moneyIn}
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                     {partnerData.transactionsIn.length === 0 && <p className="text-gray-400 text-center text-sm py-4">{t.noRecords}</p>}
                     {partnerData.transactionsIn.map(tr => (
                        <div key={tr.id} className="p-3 bg-green-50 rounded border border-green-100 flex justify-between items-center">
                           <div>
                              <p className="font-bold text-gray-800">₹{formatIndianCurrency(tr.amount)}</p>
                              <p className="text-xs text-gray-500">{formatDisplayDate(tr.date)}</p>
                           </div>
                           <div className="text-right">
                              <span className="text-xs bg-white border px-1 rounded text-gray-600">{tr.paymentType}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               {/* RIGHT: OUT */}
               <div className="flex-1 bg-white rounded-lg shadow border border-gray-200 flex flex-col">
                  <div className="p-3 bg-red-100 border-b border-red-200 font-bold text-red-800 sticky top-0">
                     {t.moneyOut}
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                     {partnerData.transactionsOut.length === 0 && <p className="text-gray-400 text-center text-sm py-4">{t.noRecords}</p>}
                     {partnerData.transactionsOut.map(tr => (
                        <div key={tr.id} className="p-3 bg-red-50 rounded border border-red-100 flex justify-between items-center">
                           <div>
                              <p className="font-bold text-gray-800">₹{formatIndianCurrency(tr.amount)}</p>
                              <p className="text-xs text-gray-500">{formatDisplayDate(tr.date)}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-xs text-gray-600 truncate max-w-[100px]">{getTranslated(tr.details)}</p>
                              <span className="text-xs bg-white border px-1 rounded text-gray-600">{tr.paymentType}</span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>
        );
      } else if (activeTab === 'labour' && labourData) {
        const isPayable = labourData.lifetimeBalance > 0;
        return (
          <div className="animate-fade-in space-y-4 font-sans">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                <button onClick={onBack} className="text-blue-600 hover:underline font-medium">{t.backToAccounts}</button>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* ADD ADJUSTMENT / BONUS BUTTON */}
                    <button 
                         onClick={() => handleOpenBonusModal()}
                         className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-bold shadow transition text-sm"
                    >
                         {t.addAdjustmentBtn}
                    </button>

                    {/* PAY BUTTON */}
                    <button 
                         onClick={onPayLabour}
                         className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold shadow transition"
                    >
                         {t.payLabourBtn}
                    </button>

                    <div className="border-l pl-2 ml-2 flex items-center gap-1">
                        <select 
                            value={pdfLanguage}
                            onChange={(e) => setPdfLanguage(e.target.value as Language)}
                            className="bg-white border border-gray-300 rounded text-xs py-2 px-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold text-gray-700"
                        >
                            <option value="en">EN</option>
                            <option value="hi">HI</option>
                            <option value="pa">PA</option>
                        </select>
                        <button onClick={onDownloadPdf} className="text-white bg-gray-800 hover:bg-black flex items-center gap-1 text-xs font-bold px-3 py-2 rounded shadow transition">
                           📄 PDF
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Labour Summary Card */}
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                  <div className="flex justify-between items-start">
                      <div>
                          <h2 className="text-3xl font-bold text-gray-900">{getTranslated(labourData.name)}</h2>
                          <span className="text-xs font-bold bg-gray-900 text-white px-2 py-1 rounded mt-1 inline-block uppercase tracking-wider">{t.labourCardLabel}</span>
                      </div>
                      <div className="text-right">
                          <p className="text-gray-500 text-xs uppercase font-bold">{t.totalNetBalance}</p>
                          <p className={`text-3xl font-bold ${isPayable ? 'text-red-600' : 'text-green-600'}`}>
                            ₹{formatIndianCurrency(Math.abs(labourData.lifetimeBalance))}
                          </p>
                          <p className="text-xs font-semibold text-gray-600">
                             {isPayable ? t.statusPayable : t.statusRecoverable}
                          </p>
                      </div>
                  </div>

                  <div className="flex flex-wrap gap-8 mt-6 pt-4 border-t border-gray-100">
                      <div>
                         <p className="text-xs text-gray-500 uppercase font-bold">{t.monthDays}</p>
                         <p className="font-bold text-xl text-black">{labourData.monthAttendanceDays}</p>
                         <p className="text-[10px] text-gray-500 font-medium">@{labourData.rate}/day</p>
                      </div>
                      <div>
                         <p className="text-xs text-gray-500 uppercase font-bold">{t.monthPayable}</p>
                         <p className="font-bold text-xl text-black">₹{formatIndianCurrency(labourData.monthPayable)}</p>
                      </div>
                      <div className="pl-6 border-l border-gray-200">
                         <p className="text-xs text-gray-500 uppercase font-bold">{t.monthPaid}</p>
                         <p className="font-bold text-xl text-blue-600">₹{formatIndianCurrency(labourData.monthPaid)}</p>
                      </div>
                  </div>
            </div>

            {/* MONTH NAVIGATION + DATE RANGE */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                 <div className="flex items-center gap-2">
                     <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 font-bold" title={t.prevMonth}>
                         &lt;
                     </button>
                     <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-600 font-bold" title={t.nextMonth}>
                         &gt;
                     </button>
                 </div>

                 {/* Date Range Inputs */}
                 <div className="flex items-center gap-2">
                    <div className="w-32">
                        <DateInput 
                            value={labourStartDate || ''} 
                            onChange={(d) => setLabourStartDate && setLabourStartDate(d)} 
                        />
                    </div>
                    <span className="text-gray-400">➜</span>
                    <div className="w-32">
                        <DateInput 
                            value={labourEndDate || ''} 
                            onChange={(d) => setLabourEndDate && setLabourEndDate(d)} 
                        />
                    </div>
                 </div>
                 
                 <div className="text-xs text-gray-400 italic">
                    {t.hisaabHelp}
                 </div>
            </div>

            {/* UNIFIED LEDGER VIEW */}
            <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden flex flex-col h-[650px]">
               {/* Header Row */}
               <div className="flex bg-gray-100 border-b border-gray-300 text-gray-700 font-bold text-sm uppercase tracking-wide sticky top-0 z-20 shadow-sm">
                   <div className="w-48 p-3 border-r border-gray-300 text-center">{t.dateHeader}</div>
                   <div className="w-24 p-3 border-r border-gray-300 text-center">{t.statusHeader}</div>
                   <div className="w-32 p-3 border-r border-gray-300 text-right">{t.workAmtHeader}</div>
                   <div className="flex-1 p-3">{t.paymentDetailsHeader}</div>
               </div>

               {/* Scrollable Body */}
               <div className="overflow-y-auto flex-1 bg-[linear-gradient(#f3f4f6_1px,transparent_1px)] bg-[length:100%_3rem]">
                   {labourData.timeline.length === 0 && (
                       <div className="p-10 text-center text-gray-400 italic">{t.noDaysInView}</div>
                   )}
                   {labourData.timeline.map((row, idx) => {
                       // SPECIAL OPENING BALANCE ROW
                       if (row.isOpeningBalance) {
                           return (
                               <div key="opening-bal" className="flex items-stretch border-b border-gray-200 min-h-[3rem] bg-gray-100 hover:bg-gray-200 transition-colors">
                                   <div className="w-48 flex items-center justify-center border-r border-gray-200 text-sm font-bold text-gray-700">
                                       Opening Balance
                                   </div>
                                   <div className="w-24 border-r border-gray-200 flex items-center justify-center text-xs text-gray-400 font-semibold uppercase tracking-wider">
                                       B/F
                                   </div>
                                   <div className={`w-32 flex items-center justify-end pr-4 border-r border-gray-200 font-bold ${row.balance && row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                       ₹{formatIndianCurrency(Math.abs(row.balance || 0))}
                                   </div>
                                   <div className="flex-1 px-4 flex items-center text-sm text-gray-500 italic">
                                       Balance Carried Forward
                                   </div>
                               </div>
                           );
                       }

                       const isSunday = new Date(row.date).getDay() === 0;
                       
                       return (
                           <div 
                                key={row.date} 
                                className={`flex items-stretch border-b border-gray-200 min-h-[3rem] transition-colors hover:bg-blue-50 ${isSunday ? 'bg-red-50/30' : ''} ${row.isHisaabDay ? 'bg-yellow-50' : ''}`}
                           >
                                {/* DATE COLUMN */}
                                <div 
                                    className="w-48 flex items-center justify-center border-r border-gray-200 text-sm font-medium text-gray-600 relative cursor-pointer select-none"
                                    onDoubleClick={() => onToggleHisaab && onToggleHisaab(row.date)}
                                    title="Double click to mark Hisaab"
                                >
                                   {formatDisplayDate(row.date)}
                                   {isSunday && <span className="ml-2 text-[10px] text-red-400 font-bold">{t.sundayLabel}</span>}
                                   
                                   {/* HISAAB MARKER */}
                                   {row.isHisaabDay && (
                                       <div className="absolute left-2 top-1/2 -translate-y-1/2 text-yellow-500 text-lg animate-bounce" title="Hisaab Marked">
                                           📌
                                       </div>
                                   )}
                                </div>

                                {/* ATTENDANCE TOGGLE COLUMN */}
                                <div className="w-24 flex items-center justify-center border-r border-gray-200 cursor-pointer" onClick={() => onToggleAttendance && onToggleAttendance(row.date)}>
                                   {row.isPresent ? (
                                       <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shadow-sm border border-green-200">
                                           ✓
                                       </div>
                                   ) : (
                                       <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 font-bold hover:bg-red-50 hover:text-red-300 transition-colors">
                                           ✗
                                       </div>
                                   )}
                                </div>

                                {/* WORK AMOUNT COLUMN (Includes Wages + Adjustments) */}
                                <div className="w-32 flex flex-col justify-center items-end pr-4 border-r border-gray-200 font-mono text-sm">
                                   {row.isPresent ? (
                                       <span className="font-bold text-gray-800">₹{row.dailyWage}</span>
                                   ) : null}
                                   
                                   {/* Extra Payables / Adjustments */}
                                   {row.adjustments && row.adjustments.map(adj => {
                                       const isNegative = adj.amount < 0;
                                       return (
                                           <div key={adj.id} className="flex items-center gap-1 group w-full justify-end">
                                               <span 
                                                   className={`text-xs font-bold cursor-pointer hover:underline text-right ${isNegative ? 'text-red-600' : 'text-green-600'}`}
                                                   onClick={() => handleOpenBonusModal(adj)}
                                               >
                                                   {isNegative ? '-' : '+'} ₹{Math.abs(adj.amount)} <span className="text-[9px] text-gray-400 font-normal block">({getTranslated(adj.note)})</span>
                                               </span>
                                               <button 
                                                   type="button"
                                                   onClick={(e) => { 
                                                       e.stopPropagation(); 
                                                       if(window.confirm(t.confirmDelete) && onDeleteAdjustment) onDeleteAdjustment(adj.id); 
                                                   }} 
                                                   className="text-red-400 hover:text-red-600 font-bold p-1.5 rounded hover:bg-red-50 transition ml-2"
                                                   title={t.deleteBtn}
                                               >
                                                   ✕
                                               </button>
                                           </div>
                                       );
                                   })}
                                   
                                   {!row.isPresent && (!row.adjustments || row.adjustments.length === 0) && (
                                       <span className="text-gray-300">-</span>
                                   )}
                                </div>

                                {/* PAYMENTS / LEDGER COLUMN */}
                                <div className="flex-1 flex items-center px-4 overflow-x-auto">
                                   {row.transactions.length > 0 ? (
                                       <div className="flex gap-2">
                                           {row.transactions.map(tr => (
                                               <div key={tr.id} className="flex items-center bg-red-50 border border-red-100 px-3 py-1 rounded text-sm shadow-sm whitespace-nowrap">
                                                   <span className="font-bold text-red-600 mr-2">{t.paidPrefix} ₹{formatIndianCurrency(tr.amount)}</span>
                                                   <span className="text-xs text-gray-500">({tr.paymentType})</span>
                                                   {tr.details && <span className="text-xs text-gray-400 ml-2 truncate max-w-[100px] border-l border-red-200 pl-2">{getTranslated(tr.details)}</span>}
                                               </div>
                                           ))}
                                       </div>
                                   ) : (
                                       <span className="text-gray-300 text-xs italic"></span>
                                   )}
                                </div>
                           </div>
                       );
                   })}
               </div>
            </div>

            {/* ADJUSTMENT / BONUS MODAL */}
            {isBonusModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-fade-in">
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
                                    type="number"
                                    required
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${bonusErrors.amount ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-blue-500 border-gray-300'}`}
                                    value={bonusForm.amount}
                                    onChange={e => { setBonusForm({...bonusForm, amount: e.target.value}); setBonusErrors({}); }}
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
                            <div className="flex gap-3">
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition">
                                    {editingAdjustmentId ? t.updateBtn : t.submitBtn}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setIsBonusModalOpen(false)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-bold transition"
                                >
                                    {t.cancelBtn}
                                </button>
                                {editingAdjustmentId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (window.confirm(t.confirmDelete) && onDeleteAdjustment) {
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
          </div>
        );
      }
      // If selected but data mismatch, fall back to list (safe default)
  }

  // --- LIST VIEW (DEFAULT) ---
  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col relative">
      {/* Account Type Tabs */}
      <div className="flex border-b overflow-x-auto">
         <button 
            className={`flex-1 py-4 px-4 text-center font-bold transition-colors whitespace-nowrap ${activeTab === 'labour' ? 'border-b-4 border-yellow-500 text-yellow-700 bg-yellow-50' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => onTabChange('labour')}
         >
            {t.tabLabour}
         </button>
         <button 
            className={`flex-1 py-4 px-4 text-center font-bold transition-colors whitespace-nowrap ${activeTab === 'partner' ? 'border-b-4 border-blue-500 text-blue-700 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => onTabChange('partner')}
         >
            {t.tabPartner}
         </button>
         <button 
            className={`flex-1 py-4 px-4 text-center font-bold transition-colors whitespace-nowrap ${activeTab === 'customer' ? 'border-b-4 border-purple-500 text-purple-700 bg-purple-50' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => onTabChange('customer')}
         >
            {t.tabCustomer}
         </button>
         <button 
            className={`flex-1 py-4 px-4 text-center font-bold transition-colors whitespace-nowrap ${activeTab === 'supplier' ? 'border-b-4 border-indigo-500 text-indigo-700 bg-indigo-50' : 'text-gray-500 hover:bg-gray-50'}`}
            onClick={() => onTabChange('supplier')}
         >
            {t.tabSupplier}
         </button>
      </div>

      {/* Actions & Search */}
      <div className="p-4 border-b bg-gray-50 flex flex-col md:flex-row gap-4 items-center justify-between">
         <div className="w-full md:w-1/2">
             <input 
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
             />
         </div>
         <button 
             onClick={onOpenAddAccount}
             className={`px-4 py-2 text-white font-semibold rounded-lg shadow transition ${
                 activeTab === 'labour' 
                    ? 'bg-yellow-500 hover:bg-yellow-600' 
                    : (activeTab === 'customer' ? 'bg-purple-600 hover:bg-purple-700' : 
                      (activeTab === 'supplier' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-500 hover:bg-blue-600'))
             }`}
         >
             {activeTab === 'labour' ? t.addLabourAccount : 
              (activeTab === 'customer' ? t.addCustomerAccount : 
              (activeTab === 'supplier' ? t.addSupplierAccount : t.addPartnerAccount))}
         </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accountList.map((acc) => (
               <div 
                  key={acc.name} 
                  onClick={() => onAccountSelect(acc.name)}
                  className="border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow bg-white flex flex-col justify-between h-32 group"
               >
                  <div className="flex justify-between items-start">
                     <h3 className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition-colors">{getTranslated(acc.name)}</h3>
                     <span className="text-gray-300">➔</span>
                  </div>
                  <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold">{t.accountBalance}</p>
                      <p className={`text-xl font-bold ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                         ₹{formatIndianCurrency(acc.balance)}
                      </p>
                  </div>
               </div>
            ))}
            {accountList.length === 0 && (
               <div className="col-span-full text-center py-10 text-gray-400">
                  {t.noAccountsFound}
               </div>
            )}
         </div>
      </div>

      {/* --- ADD ACCOUNT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl transform transition-all animate-fade-in">
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
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${accountErrors ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-blue-500 border-gray-300'}`}
                        placeholder={t.enterAccountName}
                        value={newAccountName}
                        onChange={e => { onNewAccountNameChange(e.target.value); setAccountErrors(''); }}
                    />
                    {accountErrors && <p className="text-red-500 text-xs mt-1">{accountErrors}</p>}
                </div>

                {/* Optional Rate Field only for Labour */}
                {activeTab === 'labour' && (
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">{t.enterRate}</label>
                        <input 
                            type="number"
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none border-gray-300"
                            placeholder="400"
                            value={newAccountRate}
                            onChange={e => onNewAccountRateChange(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex gap-3">
                    <button 
                        onClick={handleConfirmAddAccountClick} 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
                    >
                        {t.createBtn}
                    </button>
                    <button 
                        onClick={onCancelAddAccount} 
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