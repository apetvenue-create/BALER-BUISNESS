
import React, { useState } from 'react';
import { Translation, StockMovement, StoredAccount } from '../../types';
import { formatIndianCurrency, formatDisplayDate } from '../../utils';
import { DateInput } from '../../components/DateInput';

interface StockPageViewProps {
  t: Translation;
  currentStockKg: number;
  stockMovements: StockMovement[];
  
  // Dashboard Actions (Manual Adjustments)
  adjustQty: string;
  setAdjustQty: (val: string) => void;
  onAddStock: () => void;
  onSubtractStock: () => void;
  
  // New props for Total Sales
  totalSalesAmount: number;
  totalSalesKg: number;

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
  
  // Dispatch Action — returns true when saved
  onDispatch: () => boolean;
  
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
  
  adjustQty,
  setAdjustQty,
  onAddStock,
  onSubtractStock,
  
  totalSalesAmount,
  totalSalesKg,

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

  const displayStock = currentStockKg / 100; // Quintal only
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
  const [dispatchSuccess, setDispatchSuccess] = useState(false);
  const [adjustErrors, setAdjustErrors] = useState<string>('');
  const [editErrors, setEditErrors] = useState<string>('');

  const openEditModal = (m: StockMovement) => {
      setEditingMovement(m);
      setEditDate(m.date);
      setEditQty((m.quantityKg / 100).toString());
      setEditRate(m.ratePerQuintal ? m.ratePerQuintal.toString() : '');
      setEditVehicle(m.vehicleNumber || '');
      setEditCustomer(m.accountName || '');
      setEditNote(m.note || '');
      setEditErrors('');
  };

  const closeEditModal = () => {
      setEditingMovement(null);
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
      const qtyKg = qtyNum * 100;
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
      if (dispatchSuccess) return;
      if (!validateDispatch()) return;
      const saved = onDispatch();
      if (!saved) return;
      setDispatchErrors({});
      setDispatchSuccess(true);
      window.setTimeout(() => setDispatchSuccess(false), 1600);
  };

  const handleAdjustClick = (type: 'add' | 'sub') => {
      const qty = parseFloat(adjustQty);
      if (isNaN(qty) || qty <= 0) {
          setAdjustErrors(type === 'add' ? t.alertEnterQtyAdd : t.alertEnterQtySub);
          return;
      }
      if (type === 'sub') {
          const qtyKg = qty * 100;
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
            
            {/* SECTION 1: CURRENT STOCK DASHBOARD */}
            <div className={`rounded-lg shadow-md p-6 border-l-8 ${isLowStock ? 'bg-red-50 border-red-500' : 'bg-white border-blue-500'}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <h2 className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-1">{t.currentStockTitle}</h2>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-extrabold text-gray-900">
                                {displayStock.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xl font-bold text-gray-500">{t.unitQuintal}</span>
                        </div>
                        <div className="mt-3">
                            <button 
                                onClick={() => setShowHistoryModal(true)}
                                className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-200 shadow-sm transition flex items-center gap-1"
                            >
                                {t.viewHistoryBtn}
                            </button>
                        </div>

                        {/* TOTAL SALES SMALL SECTION */}
                        <div className="mt-4 pt-2 border-t border-dashed border-gray-200 inline-block min-w-[120px]">
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{t.totalSalesValue}</p>
                             <p className="text-base font-bold text-green-600">
                                ₹{formatIndianCurrency(totalSalesAmount)}
                             </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-stretch md:items-end gap-4 mt-4 md:mt-0 w-full md:w-auto md:min-w-[320px]">
                        {/* Manual Adjust */}
                        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                                {t.quantityLabel}
                            </label>
                            <div className="relative mb-4">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    className={`w-full px-4 py-3.5 pr-20 rounded-xl border text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 transition ${
                                        adjustErrors
                                            ? 'border-red-400 ring-1 ring-red-400'
                                            : 'border-slate-200 focus:ring-blue-400/40 focus:border-blue-400'
                                    }`}
                                    value={adjustQty}
                                    onChange={(e) => { setAdjustQty(e.target.value); setAdjustErrors(''); }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                                    {t.unitQuintal}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleAdjustClick('add')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl shadow-sm font-bold text-sm transition flex items-center justify-center gap-1.5"
                                >
                                    <span className="text-base leading-none">+</span>
                                    {t.addStockBtn.replace(/^\+\s*/, '')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAdjustClick('sub')}
                                    className="bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl shadow-sm font-bold text-sm transition flex items-center justify-center gap-1.5"
                                >
                                    <span className="text-base leading-none">−</span>
                                    {t.subtractStockBtn.replace(/^-\s*/, '')}
                                </button>
                            </div>
                            {adjustErrors && (
                                <p className="text-red-500 text-xs mt-3 text-center font-semibold">{adjustErrors}</p>
                            )}
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
                        <label className="block text-sm font-semibold text-gray-600 mb-1">{t.quantityLabel} ({t.unitQuintal})</label>
                        <input 
                            type="number"
                            placeholder="0.00"
                            value={dispatchQty}
                            onChange={e => { setDispatchQty(e.target.value); setDispatchErrors(prev => ({...prev, qty: ''})); }}
                            className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:outline-none text-lg font-mono ${dispatchErrors.qty ? 'border-red-500 ring-red-500' : 'border-gray-300 focus:ring-orange-500'}`}
                        />
                        {dispatchErrors.qty && <p className="text-red-500 text-xs mt-1">{dispatchErrors.qty}</p>}

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
                         {(dispatchErrors.customer || dispatchErrors.qty) && (
                             <p className="text-red-500 text-xs font-semibold mb-2 text-center">
                                 {dispatchErrors.qty || dispatchErrors.customer}
                             </p>
                         )}
                         <button 
                             type="button"
                             onClick={handleDispatchClick}
                             disabled={dispatchSuccess}
                             className={`w-full text-white font-bold py-2.5 rounded-lg shadow transition active:transform active:scale-95 disabled:cursor-default ${
                                 dispatchSuccess
                                     ? 'bg-emerald-600 hover:bg-emerald-600'
                                     : 'bg-orange-600 hover:bg-orange-700'
                             }`}
                         >
                             {dispatchSuccess ? `✓ ${t.dispatchBtn}` : t.dispatchBtn}
                         </button>
                    </div>
                </div>
            </div>

            {/* SECTION 3: HISTORY */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-10">
                <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                    <span className="hidden sm:block w-1.5 h-7 rounded-full bg-blue-500 shrink-0" aria-hidden />
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                        {t.stockHistoryTitle}
                    </h3>
                </div>

                {/* Portrait / mobile: equal-field cards */}
                <div className="md:hidden divide-y divide-slate-100">
                    {stockMovements.length === 0 ? (
                        <p className="px-4 py-12 text-center text-slate-400 text-base font-semibold">{t.noRecords}</p>
                    ) : (
                        [...stockMovements].reverse().map(move => {
                            const isOut = move.type === 'out' || move.type === 'adjust_sub';
                            return (
                                <article key={move.id} className="p-4 sm:p-5 space-y-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-base font-bold text-slate-900 truncate">
                                                {getTranslated(move.accountName || move.note) || '—'}
                                            </p>
                                            <p className="text-sm font-semibold text-slate-500 mt-1 tabular-nums">
                                                {formatDisplayDate(move.date)}
                                            </p>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => openEditModal(move)}
                                                className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center transition border border-slate-200 text-base font-bold"
                                                aria-label={t.updateBtn}
                                            >
                                                ✎
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDeleteStockMovement(move.id)}
                                                className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 w-10 h-10 rounded-lg flex items-center justify-center transition border border-slate-200 text-base font-bold"
                                                aria-label={t.cancelBtn}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.colGadi}</p>
                                            <p className="text-base font-bold text-slate-800 uppercase truncate">
                                                {move.vehicleNumber || '—'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.colQty}</p>
                                            <p className={`text-base font-extrabold font-mono tabular-nums ${isOut ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                {isOut ? '−' : '+'}{(move.quantityKg / 100).toFixed(2)}{' '}
                                                <span className="text-slate-400 font-sans text-xs font-bold">{t.unitQuintal}</span>
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.colRate}</p>
                                            <p className="text-base font-bold text-slate-800 tabular-nums">
                                                {move.ratePerQuintal ? `₹${move.ratePerQuintal}` : '—'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">{t.totalPriceLabel}</p>
                                            <p className="text-base font-extrabold text-slate-900 tabular-nums">
                                                {move.totalAmount ? `₹${formatIndianCurrency(move.totalAmount)}` : '—'}
                                            </p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>

                {/* Landscape / desktop: equal-width table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full table-fixed text-base">
                        <colgroup>
                            <col className="w-[14.28%]" />
                            <col className="w-[14.28%]" />
                            <col className="w-[14.28%]" />
                            <col className="w-[14.28%]" />
                            <col className="w-[14.28%]" />
                            <col className="w-[14.28%]" />
                            <col className="w-[14.28%]" />
                        </colgroup>
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-3 lg:px-4 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.dateHeader}
                                </th>
                                <th className="px-3 lg:px-4 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.tabCustomers}
                                </th>
                                <th className="px-3 lg:px-4 py-4 text-left text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.colGadi}
                                </th>
                                <th className="px-3 lg:px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.colQty}
                                </th>
                                <th className="px-3 lg:px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.colRate}
                                </th>
                                <th className="px-3 lg:px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.totalPriceLabel}
                                </th>
                                <th className="px-3 lg:px-4 py-4 text-center text-xs font-extrabold uppercase tracking-wider text-slate-600">
                                    {t.actionHeader}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {[...stockMovements].reverse().map(move => {
                                const isOut = move.type === 'out' || move.type === 'adjust_sub';
                                return (
                                    <tr key={move.id} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="px-3 lg:px-4 py-4 text-slate-700 font-bold tabular-nums truncate">
                                            {formatDisplayDate(move.date)}
                                        </td>
                                        <td className="px-3 lg:px-4 py-4 font-extrabold text-slate-900 truncate" title={getTranslated(move.accountName || move.note) || undefined}>
                                            {getTranslated(move.accountName || move.note) || '—'}
                                        </td>
                                        <td className="px-3 lg:px-4 py-4 uppercase text-slate-700 font-bold tracking-wide truncate">
                                            {move.vehicleNumber || '—'}
                                        </td>
                                        <td className={`px-3 lg:px-4 py-4 text-center font-mono tabular-nums font-extrabold text-lg ${
                                            isOut ? 'text-rose-600' : 'text-emerald-600'
                                        }`}>
                                            {isOut ? '−' : '+'}{(move.quantityKg / 100).toFixed(2)}
                                            <span className="block text-xs font-sans font-bold text-slate-400 normal-case mt-0.5">
                                                {t.unitQuintal}
                                            </span>
                                        </td>
                                        <td className="px-3 lg:px-4 py-4 text-center text-slate-800 font-bold tabular-nums">
                                            {move.ratePerQuintal ? `₹${move.ratePerQuintal}` : '—'}
                                        </td>
                                        <td className="px-3 lg:px-4 py-4 text-center font-extrabold text-slate-900 tabular-nums text-lg">
                                            {move.totalAmount ? `₹${formatIndianCurrency(move.totalAmount)}` : '—'}
                                        </td>
                                        <td className="px-3 lg:px-4 py-4">
                                            <div className="flex justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(move)}
                                                    className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 w-9 h-9 rounded-lg flex items-center justify-center transition border border-transparent hover:border-blue-100 text-base font-bold"
                                                    aria-label={t.updateBtn}
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteStockMovement(move.id)}
                                                    className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 w-9 h-9 rounded-lg flex items-center justify-center transition border border-transparent hover:border-rose-100 text-base font-bold"
                                                    aria-label={t.cancelBtn}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {stockMovements.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-14 text-center text-slate-400 text-base font-semibold">
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
               <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl animate-fade-in relative">
                   <button
                     type="button"
                     onClick={closeEditModal}
                     className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center transition"
                     aria-label={t.cancelBtn}
                     title={t.cancelBtn}
                   >
                     ✕
                   </button>
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
                           <label className="block text-sm font-semibold text-gray-600">{t.quantityLabel} ({t.unitQuintal})</label>
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
                                            {(row.prevStockKg / 100).toFixed(2)}
                                        </td>
                                        
                                        <td className="p-3 text-center">
                                            <span className={`inline-block px-2 py-1 rounded font-bold ${row.isAdd ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                                {row.isAdd ? '+' : '-'} {(row.quantityKg / 100).toFixed(2)}
                                            </span>
                                        </td>
                                        
                                        <td className="p-3 text-right font-mono font-bold text-blue-700 bg-blue-50/50">
                                            {(row.remainingStockKg / 100).toFixed(2)}
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
