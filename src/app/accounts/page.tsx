import Link from 'next/link';
import { getAccounts, getTransactions, getStatements } from '@/lib/supabase';
import { formatCurrency as money } from '@/lib/utils';
import { summarize } from '@/lib/insights';
import { BalanceReview } from '@/components/ReviewForms';
import { StatementBalances } from '@/components/StatementBalances';
import { todayInIndia } from '@/lib/presentation';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const [accounts, transactions, allStatements] = await Promise.all([getAccounts(),getTransactions(),getStatements()]);
  if (account && account !== 'unassigned' && !accounts.some(a=>a.id===account)) notFound();
  const include = (id: string | null | undefined) => !account || (account==='unassigned' ? !id : id===account);
  const rows = transactions.filter(t=>include(t.account_id));
  const statements = allStatements.filter(s=>include(s.account_id));
  const totals = summarize(rows);
  const statementCounts = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.statement_id) statementCounts.set(transaction.statement_id, (statementCounts.get(transaction.statement_id) ?? 0) + 1);
  }
  return <div><div className="page-header"><div><h1>Accounts and statements</h1><p>Review statement balances, import quality and transaction categories.</p></div><Link className="btn" href="/review">Review categories</Link></div>
    <nav className="account-filters section" aria-label="Filter accounts">{[{id:'',name:'All accounts'},...accounts,{id:'unassigned',name:'Unassigned imports'}].map(a=><Link className={`filter-pill ${(account??'')===a.id?'selected':''}`} aria-current={(account??'')===a.id?'page':undefined} key={a.id} href={a.id?`/accounts?account=${a.id}`:'/accounts'}>{a.name}</Link>)}</nav>
    <p className="section">All imported history ? {rows.length} transactions ? recorded income {money(totals.totalInflow)} ? spending and loans net of refunds {money(totals.totalOutflow)}. These are not bank balances.</p>
    <StatementBalances accounts={accounts.filter(a=>include(a.id))} statements={statements} asOf={todayInIndia()} />
    <div className="card section table-scroll"><h2>Statement history</h2><p>Showing the latest 100 of {statements.length} statements. A balance match checks arithmetic, not categories or completeness.</p><table className="data-table"><thead><tr><th>Statement</th><th>Import</th><th>Stored transactions</th><th>Balance review</th></tr></thead><tbody>{statements.slice(0,100).map(s=>{
      const actual=statementCounts.get(s.id) ?? 0;
      const r=s.reconciliation;
      return <tr key={s.id}><td><Link className="text-link" href={`/review?statement=${s.id}`}>{s.filename}</Link></td><td><span className={`badge ${s.status==='complete'?'badge-green':'badge-yellow'}`}>{s.status==='complete'?'Imported':s.status==='processing'?'Processing':'Needs review'}</span></td><td>{actual} transactions<span className={`badge ${actual===s.transaction_count?'':'badge-yellow'}`}>{actual===s.transaction_count?'Count matches':`Expected ${s.transaction_count}`}</span></td><td><span className={`badge ${r?.status==='matched'?'badge-green':r?.status==='mismatch'?'badge-red':'badge-yellow'}`}>{r?.status==='matched'?'Balances reconcile':r?.status==='mismatch'?`Needs review ? ${money(Math.abs(r.difference??0))} difference`:'Balance check unavailable'}</span>{!!r?.possible_overlap_count&&<p>{r.possible_overlap_count} possible overlapping rows; review before relying on totals.</p>}{s.status==='complete'&&<BalanceReview statement={s}/>}</td></tr>;
    })}</tbody></table></div>
    <p className="insight-box">Unassigned here means your owned transactions without an account. Legacy rows without a user owner are intentionally inaccessible in the app and need a separate database review before any reassignment.</p>
  </div>;
}
