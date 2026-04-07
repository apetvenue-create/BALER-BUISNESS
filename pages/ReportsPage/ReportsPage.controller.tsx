import React, { useState, useMemo } from 'react';
import { Translation, Transaction, Language, StockMovement } from '../../types';
import { ReportsPageView } from './ReportsPage.view';
import { PDFGenerator } from '../../services/pdfGenerator';
import { formatISODateLocal } from '../../utils';

interface ReportsPageControllerProps {
  transactions: Transaction[];
  stockMovements: StockMovement[];
  t: Translation;
  language: Language;
  getTranslated: (text?: string) => string;
}

export const ReportsPageController: React.FC<ReportsPageControllerProps> = ({
  transactions,
  stockMovements,
  t,
  language,
  getTranslated
}) => {
  // Default start date: 1st of current month
  const [startDate, setStartDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  // Default end date: last day of current month
  const [endDate, setEndDate] = useState<string>(
      formatISODateLocal(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))
  );
  
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Logic: Filter Transactions from Start Date -> End Date + Type Filter
  const filteredData = useMemo(() => {
      return transactions
          .filter(tr => {
              // STRICT ISOLATION: Do NOT include Supplier Income in Reports List
              if (tr.type === 'income' && tr.category === 'supplier') {
                  return false;
              }

              const isDateMatch = tr.date >= startDate && tr.date <= endDate;
              const isTypeMatch = filterType === 'all' || tr.type === filterType;
              return isDateMatch && isTypeMatch;
          })
          .sort((a, b) => {
              // Sort Newest First
              if (a.date !== b.date) return b.date.localeCompare(a.date);
              return b.timestamp - a.timestamp;
          });
  }, [transactions, startDate, endDate, filterType]);

  const totalIncome = useMemo(() => {
      // Rule: Total Income = Total amount of stock sold (dispatch total) for the selected date range.
      return stockMovements
        .filter(m => m.type === 'out' && m.date >= startDate && m.date <= endDate)
        .reduce((sum, m) => sum + (m.totalAmount || 0), 0);
  }, [stockMovements, startDate, endDate]);

  const totalExpense = useMemo(() => {
      // Rule: Total Expense = Total Expense - Paid to Owners
      // "Paid to Owners" is recorded as an EXPENSE with category 'partner'.
      return filteredData
        .filter(tr => tr.type === 'expense' && tr.category !== 'partner')
        .reduce((sum, tr) => sum + tr.amount, 0);
  }, [filteredData]);

  const netBalance = totalIncome - totalExpense;

  const handleDownloadPdf = async () => {
      // Pass the *sorted* filtered data, but maybe we want oldest first for ledger?
      // Usually ledgers are oldest first. 
      // The current view displays newest first. 
      // For PDF, let's stick to chronological (Oldest First) which is standard for ledgers.
      const chronologicalData = [...filteredData].reverse();
      await PDFGenerator.generateTransactionReport(chronologicalData, startDate, endDate, filterType, language);
  };

  return (
    <ReportsPageView 
        t={t}
        filteredTransactions={filteredData}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netBalance={netBalance}
        getTranslated={getTranslated}
        onDownloadPdf={handleDownloadPdf}
    />
  );
};