-- Cashflow Whisperer — Schema Migration v2
-- Run this in your Supabase SQL Editor to update existing schema
-- Adds card_name column and relaxes source constraint

-- 1. Add card_name column (nullable — only used for credit sources)
alter table public.transactions
  add column if not exists card_name text;

-- 2. Drop old strict source constraint
alter table public.transactions
  drop constraint if exists transactions_source_check;

-- 3. New constraint: just 'savings' or 'credit'
alter table public.transactions
  add constraint transactions_source_check
  check (source in ('savings', 'credit'));

-- 4. Migrate any existing rows from old source values
update public.transactions set card_name = 'HDFC Swiggy CC', source = 'credit'
  where source = 'credit_swiggy';

update public.transactions set card_name = 'Roarbank CC', source = 'credit'
  where source = 'credit_roarbank';
