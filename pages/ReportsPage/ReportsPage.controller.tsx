import React, { useState, useMemo } from 'react';
import { Translation, Transaction, Language } from '../../types';
import { ReportsPageView } from './ReportsPage.view';
import { PDFGenerator } from '../../services/pdfGenerator';

interface ReportsPageControllerProps {
  transactions: Transaction[];
  t: Translation;
  language: Language;
  getTranslated: (text?: string) => string;
}

export const ReportsPageController: React.FC<ReportsPageControllerProps> = ({
  transactions,
  t,
  language,
  getTranslated
}) => {
  // Default start date: 1st of current month
  const [startDate, setStartDate] = useState<string>(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  // Default end date: Today
  const [endDate, setEndDate] = useState<string>(
      new Date().toISOString().split('T')[0]
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

  // Logic: Summary Stats for the filtered view
  const { totalIncome, totalExpense } = useMemo(() => {
      let inc = 0;
      let exp = 0;
      filteredData.forEach(tr => {
          if (tr.type === 'income') {
              // Redundant check strictly speaking if filtered above, but good for safety
              if (tr.category !== 'supplier') {
                  inc += tr.amount;
              }
          } else {
              // Expense includes Supplier Payments (Money Out) + Operational Expense
              exp += tr.amount;
          }
      });
      return { totalIncome: inc, totalExpense: exp };
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