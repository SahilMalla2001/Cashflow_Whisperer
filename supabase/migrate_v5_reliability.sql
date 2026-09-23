-- Run after migrate_v4_auth.sql. Existing rows remain unassigned/unverified.
begin;
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  type text not null check (type in ('savings', 'credit')),
  created_at timestamptz not null default now(),
  unique(user_id, type, name)
);
alter table public.accounts enable row level security;
drop policy if exists users_manage_own_accounts on public.accounts;
create policy users_manage_own_accounts on public.accounts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.accounts to authenticated;
alter table public.statements add column if not exists account_id uuid references public.accounts(id);
alter table public.transactions add column if not exists account_id uuid references public.accounts(id);
alter table public.statements add column if not exists reconciliation jsonb;
create index if not exists transactions_statement_idx on public.transactions(statement_id);
create index if not exists transactions_account_idx on public.transactions(account_id);
-- Composite ownership references prevent linking a row to another user's account.
create unique index if not exists accounts_id_owner_key on public.accounts(id, user_id);
alter table public.statements drop constraint if exists statements_account_owner_fkey;
alter table public.statements add constraint statements_account_owner_fkey
  foreign key (account_id, user_id) references public.accounts(id, user_id);
alter table public.transactions drop constraint if exists transactions_account_owner_fkey;
alter table public.transactions add constraint transactions_account_owner_fkey
  foreign key (account_id, user_id) references public.accounts(id, user_id);
create unique index if not exists statements_id_owner_key on public.statements(id, user_id);
alter table public.transactions drop constraint if exists transactions_statement_owner_fkey;
alter table public.transactions add constraint transactions_statement_owner_fkey
  foreign key (statement_id, user_id) references public.statements(id, user_id);

-- SECURITY INVOKER preserves RLS. A row lock serializes repeated finalization.
-- Function invocation is one transaction: all inserts and completion commit together.
create or replace function public.finalize_statement_import(
  p_statement_id uuid, p_rows jsonb, p_card_name text,
  p_account_name text, p_metadata jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s public.statements%rowtype;
  account_uuid uuid;
  row_count integer;
  overlap_count integer;
  opening numeric; closing numeric; net numeric; difference numeric;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into s from public.statements
    where id = p_statement_id and user_id = auth.uid() for update;
  if not found then raise exception 'Statement not found'; end if;
  if s.status = 'complete' then
    return jsonb_build_object('count', s.transaction_count, 'reconciliation', s.reconciliation);
  end if;
  if exists(select 1 from public.transactions where statement_id = s.id) then
    raise exception 'Statement already has transactions; review it before retrying';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Invalid rows'; end if;
  row_count := jsonb_array_length(p_rows);
  if row_count < 1 or row_count > 10000 then raise exception 'Invalid transaction count'; end if;
  if length(trim(p_account_name)) not between 1 and 120 or p_account_name is null then
    raise exception 'Account name required';
  end if;
  insert into public.accounts(user_id, name, type)
    values(auth.uid(), lower(trim(p_account_name)), s.source)
    on conflict(user_id, type, name) do update set name = excluded.name
    returning id into account_uuid;
  if exists(select 1 from jsonb_to_recordset(p_rows) as r(amount numeric)
    where amount is null or amount <= 0 or amount > 10000000) then
    raise exception 'Invalid amount';
  end if;
  -- Flag overlapping statement candidates without deleting genuine repeated purchases.
  select count(*) into overlap_count
  from jsonb_to_recordset(p_rows) as r(date date, description text, amount numeric(12,2), type text)
  where exists(select 1 from public.transactions t where t.account_id = account_uuid
    and t.date = r.date and t.amount = r.amount and t.type = r.type
    and lower(trim(t.description)) = lower(trim(r.description)));
  insert into public.transactions(user_id, statement_id, account_id, date, description,
    amount, type, category, subcategory, source, card_name)
  select auth.uid(), s.id, account_uuid, r.date, r.description, r.amount, r.type,
    r.category, coalesce(r.subcategory, ''), s.source, p_card_name
  from jsonb_to_recordset(p_rows) as r(date date, description text, amount numeric(12,2),
    type text, category text, subcategory text);

  opening := (p_metadata->>'opening_balance')::numeric;
  closing := (p_metadata->>'closing_balance')::numeric;
  select sum(case when type = 'credit' then amount else -amount end) into net
    from public.transactions where statement_id = s.id;
  -- Credit-card balances are amounts owed: debits increase the balance.
  difference := round(opening + (case when s.source = 'credit' then -net else net end) - closing, 2);
  result := jsonb_build_object('status', case when opening is null or closing is null then 'unverified'
    when abs(difference) <= 0.01 then 'matched' else 'mismatch' end,
    'difference', difference, 'opening_balance', opening, 'closing_balance', closing,
    'statement_start', p_metadata->>'statement_start', 'statement_end', p_metadata->>'statement_end',
    'possible_overlap_count', overlap_count);
  update public.statements set status = 'complete', completed_at = now(),
    transaction_count = row_count, card_name = p_card_name, account_id = account_uuid,
    reconciliation = result where id = s.id;
  return jsonb_build_object('count', row_count, 'reconciliation', result);
end;
$$;
revoke all on function public.finalize_statement_import(uuid,jsonb,text,text,jsonb) from public, anon;
grant execute on function public.finalize_statement_import(uuid,jsonb,text,text,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
