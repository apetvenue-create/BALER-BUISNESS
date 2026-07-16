

import React, { useState, useMemo } from 'react';
import { Translation, StockMovement, StoredAccount, Transaction, AccountType, AccountTab, Language } from '../../types';
import { StockPageView } from './StockPage.view';
import { PDFGenerator } from '../../services/pdfGenerator';

interface StockPageControllerProps {
  t: Translation;
  language: Language;
  stockMovements: StockMovement[];
  transactions: Transaction[];
  accounts: StoredAccount[];
  
  // App-level handlers to persist changes
  onAddStockMovement: (m: StockMovement) => void;
  onUpdateStockMovement: (m: StockMovement) => void; // New
  onDeleteStockMovement: (id: number) => void; // New
  
  onAddTransaction: (t: Omit<Transaction, 'id' | 'timestamp'>) => void;
  onAddAccount: (name: string, type: AccountType) => void;
  onUpdateAccount: (acc: StoredAccount) => void;
  getTranslated: (text?: string) => string;
}

export const StockPageController: React.FC<StockPageControllerProps> = ({
  t,
  language,
  stockMovements,
  transactions,
  accounts,
  onAddStockMovement,
  onUpdateStockMovement,
  onDeleteStockMovement,
  onAddTransaction,
  onAddAccount,
  onUpdateAccount,
  getTranslated
}) => {
  // Navigation State Removed

  // Stock State — Quintal only (stored internally as KG)
  const [adjustQty, setAdjustQty] = useState(''); 

  // Derived Current Stock (use latest movement by id, not array order alone)
  const currentStockKg = useMemo(() => {
      if (stockMovements.length === 0) return 0;
      const latest = stockMovements.reduce((best, m) => (m.id > best.id ? m : best));
      return Number(latest.remainingStockKg) || 0;
  }, [stockMovements]);

  // Derived Sales Stats
  const { totalSalesAmount, totalSalesKg } = useMemo(() => {
      let amount = 0;
      let kg = 0;
      stockMovements.forEach(m => {
          if (m.type === 'out') {
              amount += (m.totalAmount || 0);
              kg += m.quantityKg;
          }
      });
      return { totalSalesAmount: amount, totalSalesKg: kg };
  }, [stockMovements]);

  // Dispatch Form State
  const [dispatchDate, setDispatchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [dispatchQty, setDispatchQty] = useState<string>('');
  const [ratePerQuintal, setRatePerQuintal] = useState<string>('');

  // -- LOGIC --

  const handleAddStock = () => {
      const qty = parseFloat(adjustQty);
      if (isNaN(qty) || qty <= 0) return; // Validation handled in View

      const qtyKg = qty * 100;
      
      const newMovement: StockMovement = {
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          type: 'adjust_add',
          quantityKg: qtyKg,
          remainingStockKg: currentStockKg + qtyKg,
          note: `${t.manualAddNote} (${qty} ${t.unitQuintal})`
      };
      onAddStockMovement(newMovement);
      setAdjustQty(''); // Clear input
  };

  const handleSubtractStock = () => {
      const qty = parseFloat(adjustQty);
      if (isNaN(qty) || qty <= 0) return; // Validation handled in View

      const qtyKg = qty * 100;
      // Insufficient stock check handled in view, but extra safety:
      if (currentStockKg < qtyKg) return;

      const newMovement: StockMovement = {
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          type: 'adjust_sub',
          quantityKg: qtyKg,
          remainingStockKg: currentStockKg - qtyKg,
          note: `${t.manualSubNote} (${qty} ${t.unitQuintal})`
      };
      onAddStockMovement(newMovement);
      setAdjustQty(''); // Clear input
  };

  // Dispatch Calculation (qty entered in Quintal)
  const dispatchTotalKg = useMemo(() => {
      const q = parseFloat(dispatchQty);
      if (isNaN(q)) return 0;
      return q * 100;
  }, [dispatchQty]);

  const dispatchTotalPrice = useMemo(() => {
      const r = parseFloat(ratePerQuintal);
      if (isNaN(r) || dispatchTotalKg === 0) return 0;
      // Rate is ALWAYS per Quintal
      const weightInQuintal = dispatchTotalKg / 100;
      return weightInQuintal * r;
  }, [dispatchTotalKg, ratePerQuintal]);

  const handleDispatch = (): boolean => {
      let customerName = selectedCustomer.trim();
      if (!customerName) return false;

      if (customerName === '__new__') {
          const name = prompt(t.enterAccountName)?.trim();
          if (!name) return false;
          onAddAccount(name, 'customer');
          customerName = name;
      }

      if (dispatchTotalKg <= 0 || dispatchTotalKg > currentStockKg) return false;

      const movement: StockMovement = {
          id: Date.now(),
          date: dispatchDate,
          type: 'out',
          quantityKg: dispatchTotalKg,
          remainingStockKg: currentStockKg - dispatchTotalKg,
          accountName: customerName,
          vehicleNumber: vehicleNumber.trim().toUpperCase() || undefined,
          ratePerQuintal: parseFloat(ratePerQuintal) || 0,
          totalAmount: Math.round(dispatchTotalPrice),
      };
      onAddStockMovement(movement);

      // Clear dispatch form so fields disappear after save
      setSelectedCustomer('');
      setVehicleNumber('');
      setDispatchQty('');
      setRatePerQuintal('');
      setDispatchDate(new Date().toISOString().split('T')[0]);
      return true;
  };

  // Filter Accounts for Dropdown
  const customerAccounts = useMemo(() => accounts.filter(a => a.type === 'customer' || a.type === 'partner'), [accounts]);
  
  const handleDownloadPdf = async () => {
      await PDFGenerator.generateStockLedger(stockMovements, language);
  };

  return (
    <StockPageView 
       t={t}
       currentStockKg={currentStockKg}
       stockMovements={stockMovements}
       
       adjustQty={adjustQty}
       setAdjustQty={setAdjustQty}
       onAddStock={handleAddStock}
       onSubtractStock={handleSubtractStock}
       
       totalSalesAmount={totalSalesAmount}
       totalSalesKg={totalSalesKg}

       dispatchDate={dispatchDate}
       setDispatchDate={setDispatchDate}
       selectedCustomer={selectedCustomer}
       setSelectedCustomer={setSelectedCustomer}
       vehicleNumber={vehicleNumber}
       setVehicleNumber={setVehicleNumber}
       dispatchQty={dispatchQty}
       setDispatchQty={setDispatchQty}
       ratePerQuintal={ratePerQuintal}
       setRatePerQuintal={setRatePerQuintal}
       
       dispatchTotalKg={dispatchTotalKg}
       dispatchTotalPrice={dispatchTotalPrice}
       onDispatch={handleDispatch}
       
       onUpdateStockMovement={onUpdateStockMovement}
       onDeleteStockMovement={onDeleteStockMovement}

       customerAccounts={customerAccounts}
       onDownloadPdf={handleDownloadPdf}
       getTranslated={getTranslated}
    />
  );
};