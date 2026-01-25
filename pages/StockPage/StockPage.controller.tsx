

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

  // Stock State
  const [unit, setUnit] = useState<'KG' | 'QUINTAL'>('QUINTAL'); 
  const [adjustQty, setAdjustQty] = useState(''); 

  // Derived Current Stock
  const currentStockKg = useMemo(() => {
      if (stockMovements.length === 0) return 0;
      return stockMovements[stockMovements.length - 1].remainingStockKg;
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

  const toggleUnit = () => {
      setUnit(prev => prev === 'KG' ? 'QUINTAL' : 'KG');
      // Convert Adjust Input if present
      if (adjustQty) {
           const val = parseFloat(adjustQty);
           if (!isNaN(val)) {
               if (unit === 'KG') setAdjustQty((val / 100).toString());
               else setAdjustQty((val * 100).toString());
           }
      }
      // Convert Dispatch Input if present
      if (dispatchQty) {
          const val = parseFloat(dispatchQty);
          if (!isNaN(val)) {
              if (unit === 'KG') setDispatchQty((val / 100).toString());
              else setDispatchQty((val * 100).toString());
          }
      }
  };

  const handleAddStock = () => {
      const qty = parseFloat(adjustQty);
      if (isNaN(qty) || qty <= 0) return; // Validation handled in View

      // Input qty respects current unit
      const qtyKg = unit === 'KG' ? qty : qty * 100;
      
      const newMovement: StockMovement = {
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          type: 'adjust_add',
          quantityKg: qtyKg,
          remainingStockKg: currentStockKg + qtyKg,
          note: `${t.manualAddNote} (${qty} ${unit === 'KG' ? t.unitKg : t.unitQuintal})`
      };
      onAddStockMovement(newMovement);
      setAdjustQty(''); // Clear input
  };

  const handleSubtractStock = () => {
      const qty = parseFloat(adjustQty);
      if (isNaN(qty) || qty <= 0) return; // Validation handled in View

      const qtyKg = unit === 'KG' ? qty : qty * 100;
      // Insufficient stock check handled in view, but extra safety:
      if (currentStockKg < qtyKg) return;

      const newMovement: StockMovement = {
          id: Date.now(),
          date: new Date().toISOString().split('T')[0],
          type: 'adjust_sub',
          quantityKg: qtyKg,
          remainingStockKg: currentStockKg - qtyKg,
          note: `${t.manualSubNote} (${qty} ${unit === 'KG' ? t.unitKg : t.unitQuintal})`
      };
      onAddStockMovement(newMovement);
      setAdjustQty(''); // Clear input
  };

  // Dispatch Calculation
  const dispatchTotalKg = useMemo(() => {
      const q = parseFloat(dispatchQty);
      if (isNaN(q)) return 0;
      return unit === 'KG' ? q : q * 100;
  }, [dispatchQty, unit]);

  const dispatchTotalPrice = useMemo(() => {
      const r = parseFloat(ratePerQuintal);
      if (isNaN(r) || dispatchTotalKg === 0) return 0;
      // Rate is ALWAYS per Quintal
      const weightInQuintal = dispatchTotalKg / 100;
      return weightInQuintal * r;
  }, [dispatchTotalKg, ratePerQuintal]);

  const handleDispatch = () => {
      if (!selectedCustomer) return; // Validation handled in View
      
      if (selectedCustomer === '__new__') {
          const name = prompt(t.enterAccountName);
          if (name) {
              onAddAccount(name, 'customer');
              setSelectedCustomer(name);
          }
          return; // Wait for re-render
      }
      
      if (dispatchTotalKg <= 0 || dispatchTotalKg > currentStockKg) return; // Validation handled in View

      // 1. Create Stock Movement (The Bill)
      const movement: StockMovement = {
          id: Date.now(),
          date: dispatchDate,
          type: 'out',
          quantityKg: dispatchTotalKg,
          remainingStockKg: currentStockKg - dispatchTotalKg,
          accountName: selectedCustomer,
          vehicleNumber: vehicleNumber,
          ratePerQuintal: parseFloat(ratePerQuintal) || 0,
          totalAmount: Math.round(dispatchTotalPrice),
          // transactionId is removed because we are not creating a cash transaction
      };
      onAddStockMovement(movement);

      // Reset
      setDispatchQty('');
      setVehicleNumber('');
      // No alert needed, View can show success toast if desired, but not required by spec
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
       unit={unit}
       onToggleUnit={toggleUnit}
       
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