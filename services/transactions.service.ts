
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
        const commonTimestamp = Date.now();
        
        // 1. Expense Record (Money Leaving Online/Bank)
        const expensePayload = {
            user_id: user.id,
            type: 'expense',
            category: 'cash_conversion',
            account_name: '', // Internal
            details: t.details ? `Internal Transfer: ${t.details}` : 'Internal Transfer: Online to Cash',
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
            details: t.details ? `Internal Transfer: ${t.details}` : 'Internal Transfer: Received from Online',
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
