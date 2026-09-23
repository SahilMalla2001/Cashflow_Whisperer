-- Read-only verification. SQL Editor may show all users; do not publish results.
select s.id, s.filename, s.status, s.transaction_count as reported_count,
  count(t.id) as stored_count, s.transaction_count = count(t.id) as counts_match,
  s.reconciliation->>'status' as balance_check
from public.statements s
left join public.transactions t on t.statement_id = s.id
group by s.id order by s.created_at desc;

select count(*) as transactions_without_statement
from public.transactions where statement_id is null;

select count(*) as ownership_mismatches
from public.transactions t join public.statements s on s.id = t.statement_id
where t.user_id is distinct from s.user_id;
