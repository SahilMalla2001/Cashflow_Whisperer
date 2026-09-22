-- Cashflow Whisperer — Schema Migration v3
-- Run after migrate_v2.sql in the Supabase SQL Editor.

create table if not exists public.statements (
  id                uuid primary key default gen_random_uuid(),
  file_hash         text not null unique,
  filename          text not null,
  file_size         integer not null check (file_size > 0),
  source            text not null check (source in ('savings', 'credit')),
  card_name         text,
  status            text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  transaction_count integer not null default 0 check (transaction_count >= 0),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

alter table public.transactions
  add column if not exists statement_id uuid references public.statements(id) on delete restrict;

alter table public.transactions
  drop constraint if exists transactions_category_check;

alter table public.transactions
  add constraint transactions_category_check
  check (category in ('Needs', 'Wants', 'Savings', 'Income', 'Loan', 'Transfer'));

create index if not exists idx_transactions_statement_id on public.transactions(statement_id);

alter table public.statements enable row level security;
drop policy if exists "allow_all" on public.statements;
create policy "allow_all" on public.statements for all using (true) with check (true);
