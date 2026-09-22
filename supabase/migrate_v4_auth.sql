-- Cashflow Whisperer — Schema Migration v4
-- Adds Supabase Auth ownership. Run in the SQL Editor after migrate_v3_ingestion.sql.

alter table public.transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.transactions drop constraint if exists transactions_category_check;
alter table public.transactions add constraint transactions_category_check
  check (category in ('Needs', 'Wants', 'Savings', 'Income', 'Loan', 'Transfer', 'Refund'));

alter table public.statements
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Statement hashes must be unique within one user's data, not across every user.
alter table public.statements drop constraint if exists statements_file_hash_key;
create unique index if not exists statements_user_file_hash_key
  on public.statements(user_id, file_hash);

create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_statements_user_id on public.statements(user_id);

drop policy if exists "allow_all" on public.transactions;
drop policy if exists "allow_all" on public.statements;

create policy "users_read_own_transactions" on public.transactions
  for select to authenticated using (user_id = auth.uid());
create policy "users_insert_own_transactions" on public.transactions
  for insert to authenticated with check (user_id = auth.uid());
create policy "users_update_own_transactions" on public.transactions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users_delete_own_transactions" on public.transactions
  for delete to authenticated using (user_id = auth.uid());

create policy "users_read_own_statements" on public.statements
  for select to authenticated using (user_id = auth.uid());
create policy "users_insert_own_statements" on public.statements
  for insert to authenticated with check (user_id = auth.uid());
create policy "users_update_own_statements" on public.statements
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users_delete_own_statements" on public.statements
  for delete to authenticated using (user_id = auth.uid());

-- Existing rows remain intact but need an owner before they are visible in the app.
-- After signing in once, copy your user ID from Supabase Auth > Users and run:
-- update public.transactions set user_id = 'YOUR_AUTH_USER_ID' where user_id is null;
-- update public.statements set user_id = 'YOUR_AUTH_USER_ID' where user_id is null;
