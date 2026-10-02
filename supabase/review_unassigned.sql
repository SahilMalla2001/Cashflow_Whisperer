-- READ ONLY. Run in SQL Editor to inspect legacy rows, not to assign/delete them.
-- Exact-looking matches are candidates, never proof of a duplicate.
select legacy.id, legacy.statement_id, legacy.date, legacy.description,
  legacy.amount, legacy.type, legacy.category, legacy.source,
  (select count(*) from public.transactions owned
   where owned.user_id is not null and owned.date = legacy.date
     and owned.amount = legacy.amount and owned.type = legacy.type
     and owned.source = legacy.source
     and lower(trim(owned.description)) = lower(trim(legacy.description))) as possible_owned_matches,
  s.user_id as linked_statement_owner,
  s.filename as linked_statement
from public.transactions legacy
left join public.statements s on s.id = legacy.statement_id
where legacy.user_id is null
order by legacy.date, legacy.id;
