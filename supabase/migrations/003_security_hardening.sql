-- Security hardening for per-user data isolation.
-- Apply this migration in the Supabase SQL editor after 001_init.sql.

alter table public.transactions enable row level security;
alter table public.accounts enable row level security;
alter table public.attendance enable row level security;
alter table public.hisaab_days enable row level security;
alter table public.adjustments enable row level security;
alter table public.owner_previous_entries enable row level security;
alter table public.stock enable row level security;
alter table public.app_settings enable row level security;

-- 001_init.sql omitted this policy. It is required when an account is renamed.
drop policy if exists "hisaab_days_update_own" on public.hisaab_days;
create policy "hisaab_days_update_own"
  on public.hisaab_days for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Explicit WITH CHECK clauses prevent an owned row from being reassigned.
drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "attendance_update_own" on public.attendance;
create policy "attendance_update_own"
  on public.attendance for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "adjustments_update_own" on public.adjustments;
create policy "adjustments_update_own"
  on public.adjustments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "owner_previous_entries_update_own" on public.owner_previous_entries;
create policy "owner_previous_entries_update_own"
  on public.owner_previous_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "stock_update_own" on public.stock;
create policy "stock_update_own"
  on public.stock for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "app_settings_update_own" on public.app_settings;
create policy "app_settings_update_own"
  on public.app_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
