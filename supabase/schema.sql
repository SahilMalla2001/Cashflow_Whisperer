-- Cashflow Whisperer — Supabase Schema
-- Run this in your Supabase SQL Editor

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  description text not null,
  amount      numeric(12, 2) not null,
  type        text not null check (type in ('credit', 'debit')),
  category    text not null check (category in ('Needs', 'Wants', 'Savings', 'Income', 'Loan')),
  subcategory text not null default '',
  source      text not null check (source in ('savings', 'credit_swiggy', 'credit_roarbank')),
  created_at  timestamptz not null default now()
);

-- Index for fast queries
create index if not exists idx_transactions_source on public.transactions(source);
create index if not exists idx_transactions_date   on public.transactions(date desc);
create index if not exists idx_transactions_type   on public.transactions(type);

-- Enable Row Level Security (RLS) — adjust as needed
alter table public.transactions enable row level security;

-- Allow all operations for now (update this when you add auth)
drop policy if exists "allow_all" on public.transactions;
create policy "allow_all" on public.transactions for all using (true) with check (true);
