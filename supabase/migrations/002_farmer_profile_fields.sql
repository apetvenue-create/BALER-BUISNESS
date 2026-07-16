-- Farmer (supplier) profile fields on accounts
alter table public.accounts add column if not exists phone text;
alter table public.accounts add column if not exists address text;
alter table public.accounts add column if not exists acres numeric;
alter table public.accounts add column if not exists date_cutter date;
