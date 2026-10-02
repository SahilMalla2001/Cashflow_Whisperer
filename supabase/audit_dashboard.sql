-- Read-only reproduction of the screenshots dated 23 September 2026.
-- Run the entire query. One result set shows exact (unrounded) database sums.
-- Results are separated by user_id so SQL Editor cannot mix different owners.
-- No rows are changed. Change the dates below for a different comparison.
with periods(label, start_date, end_date) as (
  values
    ('All imports', null::date, null::date),
    ('September 1-23', date '2026-09-01', date '2026-09-23'),
    ('August 1-23', date '2026-08-01', date '2026-08-23')
), totals as (
  select t.user_id, p.label,
    count(*) as transaction_count,
    min(t.date) as first_transaction, max(t.date) as last_transaction,
    coalesce(sum(amount) filter (where type = 'credit' and category = 'Income'), 0) as income,
    coalesce(sum(amount) filter (where type = 'debit' and category = 'Needs'), 0) as needs,
    coalesce(sum(amount) filter (where type = 'debit' and category = 'Wants'), 0) as wants,
    coalesce(sum(amount) filter (where type = 'debit' and category = 'Loan'), 0) as loans,
    coalesce(sum(amount) filter (where type = 'debit' and category = 'Savings'), 0) as investments,
    coalesce(sum(amount) filter (where type = 'credit' and category = 'Refund'), 0) as refunds,
    coalesce(sum(amount) filter (where type = 'debit' and category = 'Transfer'), 0) as transfer_debits,
    coalesce(sum(amount) filter (where source = 'savings' and type = 'credit'), 0) as all_bank_credits,
    coalesce(sum(amount) filter (where source = 'savings' and type = 'debit'), 0) as all_bank_debits,
    coalesce(sum(amount) filter (where source = 'credit' and type = 'debit'), 0) as all_card_debits,
    count(*) filter (where type = 'debit' and category in ('Needs', 'Wants')) as purchase_count,
    round(avg(amount) filter (where type = 'debit' and category in ('Needs', 'Wants')), 2) as average_purchase
  from public.transactions t cross join periods p
  where (p.start_date is null or t.date >= p.start_date)
    and (p.end_date is null or t.date <= p.end_date)
  group by t.user_id, p.label
), calculated as (
  select *, needs + wants + loans - refunds as dashboard_outflow,
    income - needs - wants - loans + refunds - investments as imported_surplus
  from totals
)
select *,
  round(100 * imported_surplus / nullif(income, 0), 2) as surplus_percent,
  income * .5 as needs_benchmark,
  income * .3 as wants_benchmark,
  income * .2 as investment_benchmark,
  all_bank_credits - all_bank_debits as bank_movement_excluding_opening_balance
from calculated
order by user_id, label;
