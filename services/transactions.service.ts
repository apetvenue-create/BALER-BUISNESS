
import { supabase } from './supabase';
import { Transaction } from '../types';

export const TransactionService = {
  async getAll(): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: Number(row.id), // Ensure number type for frontend compatibility
      type: row.type as any,
      category: row.category,
      accountName: row.account_name,
      details: row.details,
      amount: Number(row.amount),
      paymentType: row.payment_type as any,
      date: row.date,
      timestamp: Number(row.timestamp)
    }));
  },

  async create(t: Omit<Transaction, 'id'>): Promise<Transaction> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Not authenticated");

    // --- Special Logic for Cash Conversion (Internal Transfer) ---
    // Creates two records: Expense (Source) and Income (Destination)
    if (t.category === 'cash_conversion') {
        // Use caller-provided timestamp when available so we can de-dupe reliably
        // if the UI accidentally submits twice.
        const commonTimestamp = typeof t.timestamp === 'number' ? t.timestamp : Date.now();
        const cleanedDetails = (t.details || '').trim();
        const label = cleanedDetails ? cleanedDetails : 'ONLINE -> CASH';

        // Idempotency guard: if the exact same pair already exists (same timestamp window),
        // do not insert again. This prevents duplicates after reload.
        const { data: existing, error: existingError } = await supabase
          .from('transactions')
          .select('id,type,category,details,amount,payment_type,date,timestamp')
          .eq('user_id', user.id)
          .eq('category', 'cash_conversion')
          .eq('date', t.date)
          .eq('amount', t.amount)
          .eq('details', label)
          .gte('timestamp', commonTimestamp - 5)
          .lte('timestamp', commonTimestamp + 5);

        if (existingError) throw existingError;

        const hasExpenseOnline = (existing || []).some(
          (r: any) => r.type === 'expense' && r.payment_type === t.paymentType
        );
        const hasIncomeCash = (existing || []).some(
          (r: any) => r.type === 'income' && r.payment_type === 'cash'
        );

        if (hasExpenseOnline && hasIncomeCash) {
          const expenseRow = (existing || []).find(
            (r: any) => r.type === 'expense' && r.payment_type === t.paymentType
          );
          return {
            ...t,
            id: Number(expenseRow?.id ?? (existing || [])[0]?.id)
          };
        }
        
        // 1. Expense Record (Money Leaving Online/Bank)
        const expensePayload = {
            user_id: user.id,
            type: 'expense',
            category: 'cash_conversion',
            account_name: '', // Internal
            details: label,
            amount: t.amount,
            payment_type: t.paymentType, // online or bank
            date: t.date,
            timestamp: commonTimestamp
        };

        // 2. Income Record (Money Entering Cash)
        const incomePayload = {
            user_id: user.id,
            type: 'income',
            category: 'cash_conversion',
            account_name: '', // Internal
            details: label,
            amount: t.amount,
            payment_type: 'cash',
            date: t.date,
            timestamp: commonTimestamp + 1 // Ensure slight diff for sorting if strictly needed
        };

        // Perform Bulk Insert (Atomic-ish for the batch)
        const { data, error } = await supabase
            .from('transactions')
            .insert([expensePayload, incomePayload])
            .select();

        if (error) throw error;
        
        // Return the first one (Expense) to satisfy the frontend single-return expectation immediately,
        // though the UI will refresh the whole list anyway.
        return {
            ...t,
            id: Number(data[0].id)
        };
    }

    // --- Standard Single Transaction ---
    const payload = {
      user_id: user.id,
      type: t.type,
      category: t.category,
      account_name: t.accountName,
      details: t.details,
      amount: t.amount,
      payment_type: t.paymentType,
      date: t.date,
      timestamp: t.timestamp
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return {
      ...t,
      id: Number(data.id)
    };
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  async update(t: Transaction): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .update({
        type: t.type,
        category: t.category,
        account_name: t.accountName,
        details: t.details,
        amount: t.amount,
        payment_type: t.paymentType,
        date: t.date,
        timestamp: t.timestamp
      })
      .eq('id', t.id);

      if (error) throw error;
  }
};
