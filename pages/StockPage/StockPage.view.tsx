
import React, { useState } from 'react';
import { Translation, StockMovement, StoredAccount } from '../../types';
import { formatIndianCurrency, formatDisplayDate } from '../../utils';
import { DateInput } from '../../components/DateInput';

interface StockPageViewProps {
  t: Translation;
  currentStockKg: number;
  stockMovements: StockMovement[];
  unit: 'KG' | 'QUINTAL';
  onToggleUnit: () => void;
  
  // Dashboard Actions (Manual Adjustments)
  adjustQty: string;
  setAdjustQty: (val: string) => void;
  onAddStock: () => void;
  onSubtractStock: () => void;
  
  // Dispatch Form State
  dispatchDate: string;
  setDispatchDate: (d: string) => void;
  selectedCustomer: string;
  setSelectedCustomer: (c: string) => void;
  vehicleNumber: string;
  setVehicleNumber: (v: string) => void;
  dispatchQty: string;
  setDispatchQty: (q: string) => void;
  ratePerQuintal: string;
  setRatePerQuintal: (r: string) => void;
  
  // Computed for Form
  dispatchTotalKg: number;
  dispatchTotalPrice: number;
  
  // Dispatch Action
  onDispatch: () => void;
  
  // Edit/Delete Actions
  onUpdateStockMovement: (m: StockMovement) => void;
  onDeleteStockMovement: (id: number) => void;

  // Account List for dropdown
  customerAccounts: StoredAccount[];

  // PDF
  onDownloadPdf: () => void;
  getTranslated: (text?: string) => string;
}

export const StockPageView: React.FC<StockPageViewProps> = ({
  t,
  currentStockKg,
  stockMovements,
  unit,
  onToggleUnit,
  
  adjustQty,
  setAdjustQty,
  onAddStock,
  onSubtractStock,
  
  dispatchDate,
  setDispatchDate,
  selectedCustomer,
  setSelectedCustomer,
  vehicleNumber,
  setVehicleNumber,
  dispatchQty,
  setDispatchQty,
  ratePerQuintal,
  setRatePerQuintal,
  
  dispatchTotalKg,
  dispatchTotalPrice,
  onDispatch,
  
  onUpdateStockMovement,
  onDeleteStockMovement,

  customerAccounts,
  onDownloadPdf,
  getTranslated
}) => {

  const displayStock = unit === 'KG' ? currentStockKg : (currentStockKg / 100);
  const isLowStock = currentStockKg < 100;

  // Edit Modal State
  const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // We use local state for the edit form values
  const [editDate, setEditDate] = useState('');
  const [editQty, setEditQty] = useState(''); // In current Unit
  const [editRate, setEditRate] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editCustomer, setEditCustomer] = useState('');
  const [editNote, setEditNote] = useState('');

  // Validation States
  const [dispatchErrors, setDispatchErrors] = useState<Record<string, string>>({});
  const [adjustErrors, setAdjustErrors] = useState<string>('');
  const [editErrors, setEditErrors] = useState<string>('');

  const openEditModal = (m: StockMovement) => {
      setEditingMovement(m);
      setEditDate(m.date);
      setEditQty(unit === 'KG' ? m.quantityKg.toString() : (m.quantityKg / 100).toString());
      setEditRate(m.ratePerQuintal ? m.ratePerQuintal.toString() : '');
      setEditVehicle(m.vehicleNumber || '');
      setEditCustomer(m.accountName || '');
      setEditNote(m.note || '');
      setEditErrors('');
  };

  const validateEdit = (): boolean => {
      const qtyNum = parseFloat(editQty);
      if (isNaN(qtyNum) || qtyNum <= 0) {
          setEditErrors(t.alertInvalidQty);
          return false;
      }
      return true;
  };

  const handleSaveEdit = () => {
      if (!editingMovement) return;
      if (!validateEdit()) return;
      
      const qtyNum = parseFloat(editQty);
      const qtyKg = unit === 'KG' ? qtyNum : qtyNum * 100;
      let totalAmount = 0;
      let rate = 0;

      // Recalculate financial total if it's a dispatch
      if (editingMovement.type === 'out' || editingMovement.transactionId) {
           rate = parseFloat(editRate) || 0;
           totalAmount = (qtyKg / 100) * rate;
      }

      const updated: StockMovement = {
          ...editingMovement,
          date: editDate,
          quantityKg: qtyKg,
          ratePerQuintal: rate,
          vehicleNumber: editVehicle,
          accountName: editCustomer,
          note: editNote,
          totalAmount: Math.round(totalAmount)
      };

      onUpdateStockMovement(updated);
      setEditingMovement(null);
  };

  const validateDispatch = (): boolean => {
      const errors: Record<string, string> = {};
      if (!selectedCustomer) errors.customer = t.errAccountRequired;
      if (dispatchTotalKg <= 0) errors.qty = t.alertInvalidQty;
      else if (dispatchTotalKg > currentStockKg) errors.qty = t.alertInsufficientStock;
      
      setDispatchErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const handleDispatchClick = () => {
      if (!validateDispatch()) return;
      onDispatch();
      setDispatchErrors({});
  };

  const handleAdjustClick = (type: 'add' | 'sub') => {
      const qty = parseFloat(adjustQty);
      if (isNaN(qty) || qty <= 0) {
          setAdjustErrors(type === 'add' ? t.alertEnterQtyAdd : t.alertEnterQtySub);
          return;
      }
      if (type === 'sub') {
          const qtyKg = unit === 'KG' ? qty : qty * 100;
          if (currentStockKg < qtyKg) {
              setAdjustErrors(t.alertInsufficientStock);
              return;
          }
      }
      
      setAdjustErrors('');
      if (type === 'add') onAddStock();
      else onSubtractStock();
  };

  // -- HISTORY CALCULATION HELPER --
  // Calculate Previous Stock dynamically for the Modal View
  const getLedgerData = () => {
      const sorted = [...stockMovements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id);
      
      return sorted.map(m => {
          const isAdd = m.type === 'in' || m.type === 'adjust_add';
          const prevStock = isAdd 
              ? m.remainingStockKg - m.quantityKg
              : m.remainingStockKg + m.quantityKg;
          
          return {
              ...m,
              prevStockKg: prevStock,
              isAdd
          };
      });
  };


  return (
    <div className="space-y-6">
       
       {/* DASHBOARD CONTENT */}
       <div className="animate-fade-in space-y-6">
            
            {/* SECTION 1: CURRENT STOCK */}
            <div className={`rounded-lg shadow-md p-6 border-l-8 ${isLowStock ? 'bg-red-50 border-red-500' : 'bg-white border-blue-500'}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h2 className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-1">{t.currentStockTitle}</h2>
                        <div className="flex items-baseline gap-2">
                             <span className="text-5xl font-extrabold text-gray-900">
                                 {displayStock.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                             </span>
                             <span className="text-xl font-bold text-gray-500">{unit === 'KG' ? t.unitKg : t.unitQuintal}</span>
                        </div>
                        {unit === 'QUINTAL' && (
                             <p className="text-sm text-gray-400 mt-1">= {currentStockKg.toLocaleString()} {t.unitKg}</p>
                        )}
                        <div className="mt-3">
                             <button 
                                onClick={() => setShowHistoryModal(true)}
                                className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 shadow-sm transition flex items-center gap-1"
                             >
                                 {t.viewHistoryBtn}
                             </button>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-4 mt-4 md:mt-0">
                         {/* Unit Toggle */}
                         <div className="flex items-center bg-gray-100 rounded-lg p-1">
                             <span className="text-xs font-bold text-gray-500 px-2">{t.unitToggleLabel}</span>
                             <button 
                                onClick={onToggleUnit}
                                className={`px-3 py-1 rounded text-sm font-bold transition ${unit === 'KG' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                                {t.unitKg}
                             </button>
                             <button 
                                onClick={onToggleUnit}
                                className={`px-3 py-1 rounded text-sm font-bold transition ${unit === 'QUINTAL' ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                             >
                                {t.unitQuintal}
                             </button>
                         </div>

                         {/* Actions Area */}
                         <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mt-2">
                             <p className="text-xs font-bold text-gray-500 mb-2 uppercase">{t.adjustStockTitle}</p>
                             <div className="flex gap-2 items-center">
                                 <input 
                                    type="number" 
                                    placeholder="0" 
                                    className={`w-24 px-2 py-1 border rounded focus:outline-none focus:ring-2 ${adjustErrors ? 'border-red-500 ring-1 ring-red-500' : 'focus:ring-blue-500'}`}
                                    value={adjustQty}
                                    onChange={(e) => { setAdjustQty(e.target.value); setAdjustErrors(''); }}
                                 />
                                 <button onClick={() => handleAdjustClick('add')} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded shadow font-bold text-sm">
                                     {t.addStockBtn}
                                 </button>
                                 <button onClick={() => handleAdjustClick('sub')} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded shadow font-bold text-sm">
                                     {t.subtractStockBtn}
                                 </button>
                             </div>
                             {adjustErrors && <p className="text-red-500 text-xs mt-1 text-center font-semibold">{adjustErrors}</p>}
                         </div>
                    </div>
                </div>
            </div>

            {/* SECTION 2: DISPATCH FORM */}
            <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-orange-500">
                <h3 className="text-xl font-bold text-gray-800 mb-6">{t.dispatchTitle}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Date */}
                    <div>
                        <DateInput 
                            label={t.dateHeader}
                            value={dispatchDate}
                            onChange={setDispatchDate}
                        />
                    </div>

                    {/* Customer */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">{t.tabCustomers}</label>
                        <select
                            value={selectedCustomer}
                            onChange={e => { setSelectedCustomer(e.target.value); setDispatchErrors(prev => ({...prev, customer: ''})); }}
                            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:outline-none ${dispatchErrors.customer ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:ring-orange-500'}`}
                        >
                             <option value="">{t.selectAccountPlaceholder}</option>
                             {customerAccounts.map(acc => (
                                 <option key={acc.name} value={acc.name}>{acc.name}</option>
                             ))}
                             <option value="__new__" className="font-bold text-blue-600">+ {t.addNewAccount}</option>
                        </select>
                        {dispatchErrors.customer && <p className="text-red-500 text-xs mt-1">{dispatchErrors.customer}</p>}
                    </div>

                    {/* Vehicle */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">{t.vehicleNoLabel}</label>
                        <input 
                            type="text"
                            placeholder="HR-55-..."
                            value={vehicleNumber}
                            onChange={e => setVehicleNumber(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none uppercase"
                        />
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">{t.quantityLabel} ({unit === 'KG' ? t.unitKg : t.unitQuintal})</label>
                        <input 
                            type="number"
                            placeholder="0.00"
                            value={dispatchQty}
                            onChange={e => { setDispatchQty(e.target.value); setDispatchErrors(prev => ({...prev, qty: ''})); }}
                            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:outline-none text-lg font-mono ${dispatchErrors.qty ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:ring-orange-500'}`}
                        />
                        {dispatchErrors.qty && <p className="text-red-500 text-xs mt-1">{dispatchErrors.qty}</p>}
                        {unit === 'QUINTAL' && dispatchTotalKg > 0 && !dispatchErrors.qty && (
                            <p className="text-xs text-gray-500 mt-1">{t.convertedWeightLabel} {dispatchTotalKg} {t.unitKg}</p>
                        )}
                    </div>

                    {/* Rate */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">{t.rateLabel}</label>
                        <input 
                            type="number"
                            placeholder="0"
                            value={ratePerQuintal}
                            onChange={e => setRatePerQuintal(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none text-lg font-mono"
                        />
                    </div>

                    {/* Total & Action */}
                    <div className="flex flex-col justify-end">
                         <div className="mb-2 flex justify-between items-baseline">
                             <span className="text-sm font-bold text-gray-500">{t.totalPriceLabel}</span>
                             <span className="text-xl font-bold text-green-600">₹{formatIndianCurrency(dispatchTotalPrice)}</span>
                         </div>
                         <button 
                             onClick={handleDispatchClick}
                             className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg shadow transition active:transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             {t.dispatchBtn}
                         </button>
                    </div>
                </div>
            </div>

            {/* SECTION 3: HISTORY */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-10">
                <div className="bg-gray-50 p-4 border-b">
                    <h3 className="font-bold text-gray-700">{t.stockHistoryTitle}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-600 font-semibold border-b">
                            <tr>
                                <th className="p-3">{t.dateHeader}</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">{t.tabCustomers} / Note</th>
                                <th className="p-3">{t.colGadi}</th>
                                <th className="p-3 text-right">{t.colQty}</th>
                                <th className="p-3 text-right">{t.colRate}</th>
                                <th className="p-3 text-right">{t.totalPriceLabel}</th>
                                <th className="p-3 text-right">{t.colRemaining} ({t.unitKg})</th>
                                <th className="p-3 text-right">{t.actionHeader}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {[...stockMovements].reverse().map(move => (
                                <tr key={move.id} className="hover:bg-gray-50">
                                    <td className="p-3 text-gray-600">{formatDisplayDate(move.date)}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            move.type === 'in' || move.type === 'adjust_add' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-red-100 text-red-700'
                                        }`}>
                                            {move.type === 'out' 
                                                ? t.dispatchTypeLabel 
                                                : (move.type === 'adjust_add' ? t.stockAdded : t.stockSubtracted)
                                            }
                                        </span>
                                    </td>
                                    <td className="p-3 font-medium text-gray-800">
                                        {getTranslated(move.accountName || move.note) || '-'}
                                    </td>
                                    <td className="p-3 uppercase text-gray-600">{move.vehicleNumber || '-'}</td>
                                    <td className="p-3 text-right font-mono">
                                        {move.type === 'out' || move.type === 'adjust_sub' ? '-' : '+'}
                                        {unit === 'KG' ? move.quantityKg : (move.quantityKg / 100).toFixed(2)} {unit === 'KG' ? t.unitKg : t.unitQuintal}
                                    </td>
                                    <td className="p-3 text-right text-gray-500">
                                        {move.ratePerQuintal ? `₹${move.ratePerQuintal}` : '-'}
                                    </td>
                                    <td className="p-3 text-right font-bold text-gray-700">
                                        {move.totalAmount ? `₹${formatIndianCurrency(move.totalAmount)}` : '-'}
                                    </td>
                                    <td className="p-3 text-right font-mono text-blue-600 bg-blue-50/50">
                                        {move.remainingStockKg.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right flex justify-end gap-2">
                                        <button 
                                            onClick={() => openEditModal(move)}
                                            className="text-blue-600 hover:bg-blue-100 p-1 rounded transition"
                                        >
                                            ✎
                                        </button>
                                        <button 
                                            onClick={() => onDeleteStockMovement(move.id)}
                                            className="text-red-600 hover:bg-red-100 p-1 rounded transition"
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {stockMovements.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                                        {t.noRecords}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
         </div>
       
       {/* EDIT MODAL */}
       {editingMovement && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-fade-in">
                   <h3 className="text-xl font-bold mb-4 text-gray-800">{t.editStockEntryTitle}</h3>
                   
                   <div className="space-y-4">
                       <div>
                           <DateInput 
                               label={t.dateHeader}
                               value={editDate}
                               onChange={setEditDate}
                           />
                       </div>

                       <div>
                           <label className="block text-sm font-semibold text-gray-600">{t.quantityLabel} ({unit === 'KG' ? t.unitKg : t.unitQuintal})</label>
                           <input 
                               type="number"
                               value={editQty}
                               onChange={e => { setEditQty(e.target.value); setEditErrors(''); }}
                               className={`w-full border rounded px-3 py-2 font-mono ${editErrors ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                           />
                           {editErrors && <p className="text-red-500 text-xs mt-1">{editErrors}</p>}
                       </div>

                       {/* Fields only for Dispatch */}
                       {(editingMovement.type === 'out' || editingMovement.transactionId) && (
                           <>
                               <div>
                                   <label className="block text-sm font-semibold text-gray-600">{t.tabCustomers}</label>
                                   <select
                                       value={editCustomer}
                                       onChange={e => setEditCustomer(e.target.value)}
                                       className="w-full border rounded px-3 py-2"
                                   >
                                       {customerAccounts.map(acc => (
                                           <option key={acc.name} value={acc.name}>{acc.name}</option>
                                       ))}
                                   </select>
                               </div>
                               <div>
                                   <label className="block text-sm font-semibold text-gray-600">{t.vehicleNoLabel}</label>
                                   <input 
                                       type="text"
                                       value={editVehicle}
                                       onChange={e => setEditVehicle(e.target.value)}
                                       className="w-full border rounded px-3 py-2 uppercase"
                                   />
                               </div>
                               <div>
                                   <label className="block text-sm font-semibold text-gray-600">{t.rateLabel}</label>
                                   <input 
                                       type="number"
                                       value={editRate}
                                       onChange={e => setEditRate(e.target.value)}
                                       className="w-full border rounded px-3 py-2"
                                   />
                               </div>
                           </>
                       )}

                       {/* Note for manual adjustments */}
                       {(editingMovement.type === 'adjust_add' || editingMovement.type === 'adjust_sub') && (
                            <div>
                               <label className="block text-sm font-semibold text-gray-600">{t.detailsHeader}</label>
                               <input 
                                   type="text"
                                   value={editNote}
                                   onChange={e => setEditNote(e.target.value)}
                                   className="w-full border rounded px-3 py-2"
                               />
                            </div>
                       )}

                       <div className="flex gap-3 pt-2">
                           <button 
                               onClick={handleSaveEdit}
                               className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700"
                           >
                               {t.updateBtn}
                           </button>
                           <button 
                               onClick={() => setEditingMovement(null)}
                               className="flex-1 bg-gray-200 text-gray-700 py-2 rounded font-bold hover:bg-gray-300"
                           >
                               {t.cancelBtn}
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* DETAILED HISTORY MODAL */}
       {showHistoryModal && (
           <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
               <div className="bg-white rounded-lg p-6 w-full max-w-4xl shadow-2xl h-[80vh] flex flex-col animate-fade-in">
                   <div className="flex justify-between items-center mb-4 border-b pb-2">
                       <h3 className="text-2xl font-bold text-gray-800">{t.historyModalTitle}</h3>
                       <div className="flex gap-4">
                           <button onClick={onDownloadPdf} className="text-gray-600 hover:text-black flex items-center gap-1 text-sm font-bold bg-gray-100 px-3 py-1 rounded">
                               📄 PDF
                           </button>
                           <button 
                              onClick={() => setShowHistoryModal(false)}
                              className="text-gray-500 hover:text-gray-700 text-2xl font-bold px-2"
                           >
                              ✕
                           </button>
                       </div>
                   </div>
                   
                   <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700 uppercase font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 w-32">{t.dateHeader}</th>
                                    <th className="p-3">Transaction</th>
                                    <th className="p-3 text-right bg-gray-50">{t.colPrevStock}</th>
                                    <th className="p-3 text-center">{t.colChange}</th>
                                    <th className="p-3 text-right bg-blue-50">{t.colNewStock}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {/* Calculate Ledger rows dynamically */}
                                {getLedgerData().reverse().map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium text-gray-600">{formatDisplayDate(row.date)}</td>
                                        
                                        <td className="p-3">
                                            <div className="font-bold text-gray-800">
                                                {row.type === 'out' 
                                                    ? t.dispatchTypeLabel 
                                                    : (row.type === 'adjust_add' ? t.stockAdded : t.stockSubtracted)
                                                }
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {getTranslated(row.accountName ? row.accountName : row.note)}
                                                {row.vehicleNumber && ` (${row.vehicleNumber})`}
                                            </div>
                                        </td>
                                        
                                        <td className="p-3 text-right font-mono text-gray-600 bg-gray-50/50">
                                            {unit === 'KG' ? row.prevStockKg.toLocaleString() : (row.prevStockKg / 100).toFixed(2)}
                                        </td>
                                        
                                        <td className="p-3 text-center">
                                            <span className={`inline-block px-2 py-1 rounded font-bold ${row.isAdd ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                                {row.isAdd ? '+' : '-'} {unit === 'KG' ? row.quantityKg : (row.quantityKg / 100).toFixed(2)}
                                            </span>
                                        </td>
                                        
                                        <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/50">
                                            {unit === 'KG' ? row.remainingStockKg.toLocaleString() : (row.remainingStockKg / 100).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                                {stockMovements.length === 0 && (
                                    <tr><td colSpan={5} className="p-10 text-center text-gray-400">{t.noRecords}</td></tr>
                                )}
                            </tbody>
                        </table>
                   </div>
               </div>
           </div>
       )}

    </div>
  );
};
