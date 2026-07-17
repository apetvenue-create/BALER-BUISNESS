
import { supabase, getCachedUser } from './supabase';
import { Transaction } from '../types';

export const TransactionService = {
  async getAll(): Promise<Transaction[]> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("getAll: No authenticated user, returning empty array");
      return [];
    }

    try {
      // Supabase/PostgREST projects often enforce a max rows per request (commonly 1000).
      // Paginate to ensure older/high-volume accounts don't "lose" newer rows after refresh.
      const pageSize = 1000;
      let from = 0;
      let allRows: any[] = [];

      while (true) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: true })
          .range(from, to);

        if (error) throw error;

        const chunk = data || [];
        allRows = allRows.concat(chunk);
        if (chunk.length < pageSize) break;
        from += pageSize;
      }

      return (allRows || []).map(row => ({
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
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      return [];
    }
  },

  async create(t: Omit<Transaction, 'id'>): Promise<Transaction> {
    const user = await getCachedUser();
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
        const incomeRow = (existing || []).find(
          (r: any) => r.type === 'income' && r.payment_type === 'cash'
        );
        return {
          ...t,
          id: Number(expenseRow?.id ?? (existing || [])[0]?.id),
          pairedIncomeId: incomeRow ? Number(incomeRow.id) : undefined
        } as Transaction & { pairedIncomeId?: number };
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

      const expenseRow = (data || []).find((r: any) => r.type === 'expense') || data?.[0];
      const incomeRow = (data || []).find((r: any) => r.type === 'income') || data?.[1];

      // Return expense id + paired income id so the UI can patch optimistic rows
      // without a full list refetch.
      return {
          ...t,
          id: Number(expenseRow.id),
          pairedIncomeId: incomeRow ? Number(incomeRow.id) : undefined
      } as Transaction & { pairedIncomeId?: number };
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
    const user = await getCachedUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) throw error;
  },
  
  async update(t: Transaction): Promise<void> {
    const user = await getCachedUser();
    if (!user) throw new Error('Not authenticated');

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
      .eq('id', t.id)
      .eq('user_id', user.id);

      if (error) throw error;
  }
};
