import type { Statement } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

export function StatementBalances({ statements, accounts, asOf }: { statements: Statement[]; accounts: { id: string; name: string; type: string }[]; asOf: string }) {
  return <section className="card section"><h2>Bank statement balances</h2><p>Dated snapshots, separate from income and spending. These are not live bank balances.</p>
    <div className="balance-list">{accounts.filter(a => a.type === 'savings').map(a => {
      const latest = statements.filter(s => s.account_id === a.id && s.status === 'complete' && s.reconciliation?.statement_end && s.reconciliation.statement_end <= asOf)
        .sort((x, y) => y.reconciliation!.statement_end!.localeCompare(x.reconciliation!.statement_end!) || y.created_at.localeCompare(x.created_at))[0];
      const r = latest?.reconciliation;
      return <div className="balance-item" key={a.id}><div><strong>{a.name}</strong><p>{r?.statement_end ? `Most recent dated statement on or before ${asOf}: ${r.statement_end}` : `No dated closing balance available on or before ${asOf}.`}</p><span className={`badge ${r?.status === 'matched' ? 'badge-green' : 'badge-yellow'}`}>{r?.status === 'matched' ? 'Balances reconcile' : r?.status === 'mismatch' ? 'Needs review' : 'Balance check unavailable'}</span></div><div><strong>{typeof r?.closing_balance === 'number' ? formatCurrency(r.closing_balance) : 'Not available'}</strong><p>{r?.origin === 'user_review' ? 'Entered from statement during review' : 'Extracted from statement'}</p></div></div>;
    })}</div>
    <p><Link className="text-link" href="/accounts">Review statement balances and dates →</Link></p>
    <p className="text-sm">Older undated or unassigned imports are not used to infer a balance. Matching totals do not prove every row is correct.</p>
  </section>;
}
