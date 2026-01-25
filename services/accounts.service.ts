

import { supabase } from './supabase';
import { StoredAccount, AccountType, ManualAdjustment } from '../types';

export const AccountService = {
  async getAll(): Promise<StoredAccount[]> {
    // 1. Fetch Accounts
    const { data: accountsData, error: accError } = await supabase
      .from('accounts')
      .select('*');
    if (accError) throw accError;

    // 2. Fetch Related Data (Attendance, Hisaab, Adjustments)
    const { data: attendanceData } = await supabase.from('attendance').select('*');
    const { data: hisaabData } = await supabase.from('hisaab_days').select('*');
    const { data: adjustmentsData } = await supabase.from('adjustments').select('*');

    // 3. Map to Frontend Structure
    return (accountsData || []).map(acc => {
      const accName = acc.name;
      
      // Map Attendance: Record<date, boolean>
      // We now load explicit false values (Absent) too
      const attendanceMap: Record<string, boolean> = {};
      (attendanceData || [])
        .filter((a: any) => a.account_name === accName)
        .forEach((a: any) => {
          attendanceMap[a.date] = a.is_present;
        });

      // Map Hisaab Days
      const hisaabMap: Record<string, boolean> = {};
      (hisaabData || [])
        .filter((h: any) => h.account_name === accName)
        .forEach((h: any) => {
          hisaabMap[h.date] = true;
        });

      // Map Adjustments
      const adjustments: ManualAdjustment[] = (adjustmentsData || [])
        .filter((adj: any) => adj.account_name === accName)
        .map((adj: any) => ({
          id: Number(adj.id),
          date: adj.date,
          amount: Number(adj.amount),
          note: adj.note
        }));

      return {
        name: acc.name,
        type: acc.type as AccountType,
        rate: acc.rate ? Number(acc.rate) : undefined,
        attendance: attendanceMap,
        hisaabDays: hisaabMap,
        manualAdjustments: adjustments
      };
    });
  },

  async create(name: string, type: AccountType, rate?: number): Promise<void> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from('accounts')
      .insert({
        user_id: user.id,
        name,
        type,
        rate
      });
    
    if (error) throw error;
  },

  async rename(oldName: string, newName: string): Promise<void> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Not authenticated");

    // 1. Accounts Table
    const { error } = await supabase
        .from('accounts')
        .update({ name: newName })
        .eq('name', oldName)
        .eq('user_id', user.id);
        
    if (error) throw error;

    // 2. Transactions
    await supabase.from('transactions').update({ account_name: newName }).eq('account_name', oldName).eq('user_id', user.id);

    // 3. Stock
    await supabase.from('stock').update({ account_name: newName }).eq('account_name', oldName).eq('user_id', user.id);

    // 4. Attendance
    await supabase.from('attendance').update({ account_name: newName }).eq('account_name', oldName).eq('user_id', user.id);

    // 5. Hisaab Days
    await supabase.from('hisaab_days').update({ account_name: newName }).eq('account_name', oldName).eq('user_id', user.id);

    // 6. Adjustments
    await supabase.from('adjustments').update({ account_name: newName }).eq('account_name', oldName).eq('user_id', user.id);
  },

  // Attendance Operations
  // Updated to support tri-state: true=Present, false=Absent, null=Delete
  async toggleAttendance(accountName: string, date: string, isPresent: boolean | null): Promise<void> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    // Always clean up existing record for this date to ensure no duplicates if constraints are missing,
    // or to handle the update logic simply.
    await supabase.from('attendance')
        .delete()
        .eq('account_name', accountName)
        .eq('date', date);

    if (isPresent !== null && isPresent !== undefined) {
      await supabase.from('attendance').insert({
        user_id: user.id,
        account_name: accountName,
        date,
        is_present: isPresent
      });
    }
  },

  // Hisaab Operations
  async toggleHisaab(accountName: string, date: string, isHisaab: boolean): Promise<void> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    if (isHisaab) {
      await supabase.from('hisaab_days').insert({
        user_id: user.id,
        account_name: accountName,
        date
      });
    } else {
      await supabase.from('hisaab_days')
        .delete()
        .eq('account_name', accountName)
        .eq('date', date);
    }
  },

  // Adjustment Operations
  async addAdjustment(accountName: string, adj: Omit<ManualAdjustment, 'id'>): Promise<ManualAdjustment> {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error("Not authenticated");

    const { data, error } = await supabase
      .from('adjustments')
      .insert({
        user_id: user.id,
        account_name: accountName,
        date: adj.date,
        amount: adj.amount,
        note: adj.note
      })
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: Number(data.id),
      date: data.date,
      amount: Number(data.amount),
      note: data.note
    };
  },

  async updateAdjustment(adj: ManualAdjustment): Promise<void> {
    await supabase.from('adjustments')
      .update({
        date: adj.date,
        amount: adj.amount,
        note: adj.note
      })
      .eq('id', adj.id);
  },

  async deleteAdjustment(id: number): Promise<void> {
    await supabase.from('adjustments').delete().eq('id', id);
  }
};