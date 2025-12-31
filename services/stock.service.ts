
import { supabase } from './supabase';
import { StockMovement } from '../types';

export const StockService = {
  async getAll(): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock')
      .select('*')
      .order('id', { ascending: true }); // ID usually correlates with insertion time/sequence

    if (error) throw error;

    return (data || []).map(row => ({
      id: Number(row.id),
      date: row.date,
      type: row.type as any,
      quantityKg: Number(row.quantity_kg),
      remainingStockKg: Number(row.remaining_stock_kg),
      accountName: row.account_name,
      vehicleNumber: row.vehicle_number,
      ratePerQuintal: row.rate_per_quintal ? Number(row.rate_per_quintal) : undefined,
      totalAmount: row.total_amount ? Number(row.total_amount) : undefined,
      note: row.note,
      transactionId: row.transaction_id ? Number(row.transaction_id) : undefined
    }));
  },

  async create(s: StockMovement): Promise<StockMovement> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Not authenticated");

    const payload = {
      user_id: user.id,
      date: s.date,
      type: s.type,
      quantity_kg: s.quantityKg,
      remaining_stock_kg: s.remainingStockKg,
      account_name: s.accountName,
      vehicle_number: s.vehicleNumber,
      rate_per_quintal: s.ratePerQuintal,
      total_amount: s.totalAmount,
      note: s.note,
      transaction_id: s.transactionId
    };

    const { data, error } = await supabase
      .from('stock')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return {
      ...s,
      id: Number(data.id)
    };
  },

  async update(s: StockMovement): Promise<void> {
    const payload = {
      date: s.date,
      type: s.type,
      quantity_kg: s.quantityKg,
      remaining_stock_kg: s.remainingStockKg,
      account_name: s.accountName,
      vehicle_number: s.vehicleNumber,
      rate_per_quintal: s.ratePerQuintal,
      total_amount: s.totalAmount,
      note: s.note
    };

    const { error } = await supabase
      .from('stock')
      .update(payload)
      .eq('id', s.id);
      
    if (error) throw error;
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabase.from('stock').delete().eq('id', id);
    if (error) throw error;
  }
};
