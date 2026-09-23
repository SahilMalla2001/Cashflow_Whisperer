import Link from 'next/link';
import { getAccounts, getTransactions, createClient } from '@/lib/supabase';
import { formatCurrency as money } from '@/lib/utils';
import { summarize } from '@/lib/insights';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const [accounts, transactions] = await Promise.all([getAccounts(), getTransactions()]);
  if (account && account !== 'unassigned' && !accounts.some(a => a.id === account)) notFound();
  const rows = account ? transactions.filter(t => account === 'unassigned' ? !t.account_id : t.account_id === account) : transactions;
  const totals = summarize(rows);
  const client = await createClient();
  let query = client.from('statements').select('id,filename,status,transaction_count,reconciliation,account_id').order('created_at', { ascending: false }).limit(100);
  if (account === 'unassigned') query = query.is('account_id', null);
  else if (account && accounts.some(a => a.id === account)) query = query.eq('account_id', account);
  const { data: statements, error } = await query;
  if (error) throw new Error('Unable to load statement history. Apply migrate_v5_reliability.sql if upgrading.');
  return <div>
    <div className="page-header"><div><h1>Accounts and statement quality</h1><p>Separate account histories and review extracted balance checks.</p></div></div>
    <nav className="card section" style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <Link href="/accounts">All accounts</Link>
      {accounts.map(a => <Link key={a.id} href={`/accounts?account=${a.id}`}>{a.name} ({a.type})</Link>)}
      <Link href="/accounts?account=unassigned">Older / unassigned imports</Link>
    </nav>
    <p>{rows.length} transactions · income {money(totals.totalInflow)} · spending and loans net of refunds {money(totals.totalOutflow)}. These totals are not account balances.</p>
    <div className="card section" style={{ overflowX: 'auto' }}><h2>Latest 100 statements</h2>
      <p>A match checks extracted balances only. Missing balances remain unverified; mismatches need review against the PDF.</p>
      <table className="data-table"><thead><tr><th>Statement</th><th>Import status</th><th>Stored / reported rows</th><th>Balance check</th></tr></thead><tbody>
        {(statements ?? []).map(s => {
          const actual = transactions.filter(t => t.statement_id === s.id).length;
          return <tr key={s.id}><td>{s.filename}</td><td>{s.status}</td><td>{actual} / {s.transaction_count}{actual !== s.transaction_count ? ' · review needed' : ''}</td><td>{s.reconciliation?.status ?? 'unverified'}{s.reconciliation?.status === 'mismatch' ? ` · difference ${money(Number(s.reconciliation.difference))}` : ''}{s.reconciliation?.possible_overlap_count > 0 ? ` · ${s.reconciliation.possible_overlap_count} possible overlapping rows` : ''}</td></tr>;
        })}
      </tbody></table>
    </div>
    <div className="card" style={{ overflowX: 'auto' }}><h2>Latest 100 transactions</h2>
      <table className="data-table"><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>
        {rows.slice(0, 100).map(t => <tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{t.category}</td><td>{t.type === 'credit' ? '+' : '-'}{money(Number(t.amount))}</td></tr>)}
      </tbody></table>
    </div>
  </div>;
}
