

import { supabase, getCachedUser } from './supabase';
import { StoredAccount, AccountType, ManualAdjustment, OwnerPreviousEntry, FarmerProfileDetails } from '../types';
import { SettingsService } from './settings.service';

const FARMER_DETAILS_KEY = 'farmerDetailsByName';

const readFarmerDetailsMap = async (): Promise<Record<string, FarmerProfileDetails>> => {
  const raw = await SettingsService.get(FARMER_DETAILS_KEY);
  return raw && typeof raw === 'object' ? raw : {};
};

const writeFarmerDetailsMap = async (map: Record<string, FarmerProfileDetails>) => {
  await SettingsService.set(FARMER_DETAILS_KEY, map);
};

export const AccountService = {
  async getAll(): Promise<StoredAccount[]> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("getAll: No authenticated user, returning empty array");
      return [];
    }

    try {
      // 1. Fetch Accounts
      const { data: accountsData, error: accError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);
      if (accError) throw accError;

      // 2. Fetch Related Data (Attendance, Hisaab, Adjustments) - parallel, with individual try/catch
      const [attendanceRes, hisaabRes, adjustmentsRes, ownerPrevRes, farmerDetailsMap] = await Promise.all([
        supabase.from('attendance').select('*').eq('user_id', user.id).then(r => ({ status: 'fulfilled' as const, value: r })),
        supabase.from('hisaab_days').select('*').eq('user_id', user.id).then(r => ({ status: 'fulfilled' as const, value: r })),
        supabase.from('adjustments').select('*').eq('user_id', user.id).then(r => ({ status: 'fulfilled' as const, value: r })),
        supabase.from('owner_previous_entries').select('*').eq('user_id', user.id).then(r => ({ status: 'fulfilled' as const, value: r })),
        readFarmerDetailsMap().catch(() => ({} as Record<string, FarmerProfileDetails>)),
      ]);

      const attendanceData = !attendanceRes.value.error ? attendanceRes.value.data || [] : [];
      const hisaabData = !hisaabRes.value.error ? hisaabRes.value.data || [] : [];
      const adjustmentsData = !adjustmentsRes.value.error ? adjustmentsRes.value.data || [] : [];
      const ownerPrevData = !ownerPrevRes.value.error ? ownerPrevRes.value.data || [] : [];

      if (ownerPrevRes.value.error) {
        console.warn('owner_previous_entries fetch failed:', ownerPrevRes.value.error);
      }

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

        const ownerPreviousEntries: OwnerPreviousEntry[] =
          acc.type === 'partner'
            ? (ownerPrevData || [])
                .filter((row: any) => row.account_name === accName)
                .map((row: any) => ({
                  id: Number(row.id),
                  date: row.date,
                  amount: Number(row.amount),
                  kind: row.kind as 'received' | 'paid',
                  note: row.note || undefined
                }))
            : [];

        const savedFarmer = farmerDetailsMap[accName] || {};
        const farmerFields =
          acc.type === 'supplier'
            ? {
                phone: (acc.phone as string) || savedFarmer.phone || undefined,
                address: (acc.address as string) || savedFarmer.address || undefined,
                acres:
                  acc.acres != null && acc.acres !== ''
                    ? Number(acc.acres)
                    : savedFarmer.acres,
                dateCutter: (acc.date_cutter as string) || savedFarmer.dateCutter || undefined,
              }
            : {};

        return {
          name: acc.name,
          type: acc.type as AccountType,
          rate: acc.rate ? Number(acc.rate) : undefined,
          attendance: attendanceMap,
          hisaabDays: hisaabMap,
          manualAdjustments: adjustments,
          ...(acc.type === 'partner' ? { ownerPreviousEntries } : {}),
          ...farmerFields,
        };
      });
    } catch (error) {
      console.error("Failed to fetch accounts, using empty fallback", error);
      return [];
    }
  },

  async create(
    name: string,
    type: AccountType,
    rate?: number,
    details?: FarmerProfileDetails
  ): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("create: No authenticated user, skipping");
      return;
    }

    const baseRow: Record<string, unknown> = {
      user_id: user.id,
      name,
      type,
      rate,
    };

    if (type === 'supplier' && details) {
      baseRow.phone = details.phone || null;
      baseRow.address = details.address || null;
      baseRow.acres = details.acres ?? null;
      baseRow.date_cutter = details.dateCutter || null;
    }

    let { error } = await supabase.from('accounts').insert(baseRow);

    // If farmer columns are missing on the remote DB, retry without them
    if (error && type === 'supplier' && details) {
      const retry = await supabase.from('accounts').insert({
        user_id: user.id,
        name,
        type,
        rate,
      });
      error = retry.error;
    }

    if (error) throw error;

    if (type === 'supplier' && details) {
      const map = await readFarmerDetailsMap();
      map[name] = {
        phone: details.phone || undefined,
        address: details.address || undefined,
        acres: details.acres,
        dateCutter: details.dateCutter || undefined,
      };
      await writeFarmerDetailsMap(map);
    }
  },

  async updateFarmerDetails(accountName: string, details: FarmerProfileDetails): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("updateFarmerDetails: No authenticated user, skipping");
      return;
    }

    const map = await readFarmerDetailsMap();
    map[accountName] = {
      phone: details.phone || undefined,
      address: details.address || undefined,
      acres: details.acres,
      dateCutter: details.dateCutter || undefined,
    };
    await writeFarmerDetailsMap(map);

    const { error } = await supabase
      .from('accounts')
      .update({
        phone: details.phone || null,
        address: details.address || null,
        acres: details.acres ?? null,
        date_cutter: details.dateCutter || null,
      })
      .eq('name', accountName)
      .eq('user_id', user.id);

    if (error) {
      console.warn('Farmer DB column update skipped:', error.message);
    }
  },

  async rename(oldName: string, newName: string): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("rename: No authenticated user, skipping");
      return;
    }

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

    // 7. Owner previous amounts
    await supabase.from('owner_previous_entries').update({ account_name: newName }).eq('account_name', oldName).eq('user_id', user.id);

    // 8. Farmer profile map key
    try {
      const map = await readFarmerDetailsMap();
      if (map[oldName]) {
        map[newName] = map[oldName];
        delete map[oldName];
        await writeFarmerDetailsMap(map);
      }
    } catch {
      // ignore
    }
  },

  /** Removes only the `accounts` row so the name disappears from Ledgers; transactions, stock, etc. stay. */
  async removeAccountFromLedger(accountName: string): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("removeAccountFromLedger: No authenticated user, skipping");
      return;
    }

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('name', accountName)
      .eq('user_id', user.id);

    if (error) throw error;

    try {
      const map = await readFarmerDetailsMap();
      if (map[accountName]) {
        delete map[accountName];
        await writeFarmerDetailsMap(map);
      }
    } catch {
      // ignore
    }
  },

  // Attendance Operations
  // Updated to support tri-state: true=Present, false=Absent, null=Delete
  async toggleAttendance(accountName: string, date: string, isPresent: boolean | null): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("toggleAttendance: No authenticated user, skipping");
      return;
    }

    // Always clean up existing record for this date to ensure no duplicates if constraints are missing,
    // or to handle the update logic simply.
    const delRes = await supabase.from('attendance')
        .delete()
        .eq('user_id', user.id)
        .eq('account_name', accountName)
        .eq('date', date);
    if (delRes.error) throw delRes.error;

    if (isPresent !== null && isPresent !== undefined) {
      const insRes = await supabase.from('attendance').insert({
        user_id: user.id,
        account_name: accountName,
        date,
        is_present: isPresent
      });
      if (insRes.error) throw insRes.error;
    }
  },

  // Hisaab Operations
  async toggleHisaab(accountName: string, date: string, isHisaab: boolean): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("toggleHisaab: No authenticated user, skipping");
      return;
    }

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
        .eq('date', date)
        .eq('user_id', user.id);
    }
  },

  // Adjustment Operations
  async addAdjustment(accountName: string, adj: Omit<ManualAdjustment, 'id'>): Promise<ManualAdjustment> {
    const user = await getCachedUser();
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
    const user = await getCachedUser();
    if (!user) {
      console.warn("updateAdjustment: No authenticated user, skipping");
      return;
    }
    await supabase.from('adjustments')
      .update({
        date: adj.date,
        amount: adj.amount,
        note: adj.note
      })
      .eq('id', adj.id);
  },

  async deleteAdjustment(id: number): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("deleteAdjustment: No authenticated user, skipping");
      return;
    }
    await supabase.from('adjustments').delete().eq('id', id);
  },

  async addOwnerPreviousEntry(
    accountName: string,
    entry: Omit<OwnerPreviousEntry, 'id'>
  ): Promise<OwnerPreviousEntry> {
    const user = await getCachedUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('owner_previous_entries')
      .insert({
        user_id: user.id,
        account_name: accountName,
        date: entry.date,
        amount: entry.amount,
        kind: entry.kind,
        note: entry.note ?? null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: Number(data.id),
      date: data.date,
      amount: Number(data.amount),
      kind: data.kind as 'received' | 'paid',
      note: data.note || undefined
    };
  },

  async updateOwnerPreviousEntry(entry: OwnerPreviousEntry): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("updateOwnerPreviousEntry: No authenticated user, skipping");
      return;
    }

    const { error } = await supabase
      .from('owner_previous_entries')
      .update({
        date: entry.date,
        amount: entry.amount,
        kind: entry.kind,
        note: entry.note ?? null
      })
      .eq('id', entry.id)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async deleteOwnerPreviousEntry(id: number): Promise<void> {
    const user = await getCachedUser();
    if (!user) {
      console.warn("deleteOwnerPreviousEntry: No authenticated user, skipping");
      return;
    }

    const { error } = await supabase
      .from('owner_previous_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  }
};