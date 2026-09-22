-- Cashflow Whisperer — Supabase Schema
-- Run this in your Supabase SQL Editor

create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  description text not null,
  amount      numeric(12, 2) not null,
  type        text not null check (type in ('credit', 'debit')),
  category    text not null check (category in ('Needs', 'Wants', 'Savings', 'Income', 'Loan', 'Transfer', 'Refund')),
  subcategory text not null default '',
  source      text not null check (source in ('savings', 'credit')),
  card_name   text,
  statement_id uuid,
  created_at  timestamptz not null default now()
);

create table if not exists public.statements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  file_hash         text not null,
  filename          text not null,
  file_size         integer not null check (file_size > 0),
  source            text not null check (source in ('savings', 'credit')),
  card_name         text,
  status            text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

create unique index if not exists statements_user_file_hash_key
  on public.statements(user_id, file_hash);

alter table public.transactions
  add constraint transactions_statement_id_fkey
  foreign key (statement_id) references public.statements(id) on delete restrict;

-- Index for fast queries
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_source on public.transactions(source);
create index if not exists idx_transactions_date   on public.transactions(date desc);
create index if not exists idx_transactions_type   on public.transactions(type);

-- Enable Row Level Security (RLS) — adjust as needed
alter table public.transactions enable row level security;
alter table public.statements enable row level security;

create policy "users_manage_own_transactions" on public.transactions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users_manage_own_statements" on public.statements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
