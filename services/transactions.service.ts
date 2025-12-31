
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
