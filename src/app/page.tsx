export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { getAccounts, getStatements, getTransactions } from '@/lib/supabase';
import { formatCurrency as money } from '@/lib/utils';
import { summarize } from '@/lib/insights';
import { todayInIndia, monthLabel, periodRows, percentage, displayMerchant } from '@/lib/presentation';
import { comparisonCoverage } from '@/lib/coverage';
import { MonthlyInsights } from '@/components/MonthlyInsights';
import { AdvancedInsights } from '@/components/AdvancedInsights';
import { StatementBalances } from '@/components/StatementBalances';
import { DashboardCharts } from '@/components/DashboardCharts';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const [params, all, statements, accounts] = await Promise.all([searchParams, getTransactions(), getStatements(), getAccounts()]);
  const today = todayInIndia();
  const available = [...new Set(all.filter(t => t.date <= today).map(t => t.date.slice(0, 7)))].sort().reverse();
  const requested = params.month;
  const month = requested === 'all' ? null : requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) && requested <= today.slice(0, 7) ? requested : available[0] ?? today.slice(0, 7);
  const options = [...new Set([today.slice(0, 7), ...(month ? [month] : []), ...available])].sort().reverse();
  const rows = periodRows(all, month, today);
  const s = summarize(rows);
  const scope = month ? `${monthLabel(month)}${month === today.slice(0, 7) ? ' ? month to date' : ''}` : 'All imported history';
  const coverage = month ? comparisonCoverage(all, statements, month, today) : null;
  const asOf = !month || month === today.slice(0, 7) ? today : new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).toISOString().slice(0,10);
  const charts = [...new Set(rows.map(t => t.date.slice(0,7)))].sort().map(m => {
    const totals = summarize(rows.filter(t => t.date.startsWith(m)));
    return { month: monthLabel(m), Inflow: totals.totalInflow, Outflow: totals.totalOutflow };
  });
  const attention = statements.filter(st => st.status !== 'complete' || st.reconciliation?.status !== 'matched' || st.reconciliation.possible_overlap_count);
  return <div>
    <div className="page-header"><div><h1>Dashboard</h1><p>{scope} ? based on imported records</p></div>
      <form action="/" className="period-filter"><label htmlFor="period">Period</label><select id="period" name="month" className="input" defaultValue={month ?? 'all'}>{options.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}<option value="all">All imported history</option></select><button className="btn btn-primary" type="submit">Apply</button></form>
    </div>
    <div className="insight-box section"><strong>{attention.length ? `${attention.length} statements need a balance or quality review` : 'Review your import coverage'}</strong><p>{coverage?.reason ?? 'All-time totals combine different statement periods. They do not represent a monthly budget or an account balance.'}</p><Link className="text-link" href="/accounts">Review accounts and statements ?</Link></div>
    <div className="grid-4 section">
      {[
        ['Recorded income', money(s.totalInflow), 'Credits categorized as Income'],
        ['Spending & loans', money(s.totalOutflow), 'Needs + Wants + loans ? refunds'],
        ['Imported surplus', money(s.savings), 'Income ? spending ? investments; not bank balance'],
        ['Surplus / income', s.savingsRate === null ? 'N/A' : `${s.savingsRate.toFixed(1)}%`, s.savingsRate === null ? 'No positive income recorded in this period' : 'After spending, loans and investments'],
      ].map(([label,value,note]) => <div className="stat-card" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><p className="stat-sub">{note}</p></div>)}
    </div>
    <details className="card section"><summary>How these figures are calculated</summary><p>{rows.length} transactions in {scope.toLowerCase()}. Needs {money(s.needs)} + Wants {money(s.wants)} + loans {money(s.loanPayments)} ? refunds {money(s.refunds)} = {money(s.totalOutflow)}.</p><p>Income {money(s.totalInflow)} ? {money(s.totalOutflow)} ? investments {money(s.savingsCategory)} = surplus {money(s.savings)}. Transfers of {money(s.transfers)} are excluded. Amounts on screen are rounded to whole rupees.</p><p>Refunds are not linked back to purchase categories. Categorization and missing or overlapping statements can change these totals.</p></details>
    <StatementBalances statements={statements} accounts={accounts} asOf={asOf} />
    {month && <MonthlyInsights transactions={all} month={month} today={today} coverage={coverage!} />}
    <div className="grid-2 section"><div className="card"><h2>Recorded income and spending</h2><p>{scope}. Spending includes loans and subtracts refunds; transfers and investments are excluded.</p>{charts.length ? <DashboardCharts data={charts} /> : <p>No imported transactions in this period.</p>}</div>
      <div className="card"><h2>Category reference points</h2><p>50 / 30 / 20 illustration, not a verified budget assessment.</p>{s.totalInflow > 0 ? [['Needs (50%)',s.needs,.5],['Wants (30%)',s.wants,.3],['Investments (20%)',s.savingsCategory,.2]].map(([label,amount,share]) => <div className="benchmark" key={String(label)}><div className="flex justify-between"><strong>{label}</strong><span>{money(Number(amount))} / {money(s.totalInflow * Number(share))}</span></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.max(0,Math.min(100,Number(amount)/(s.totalInflow*Number(share))*100))}%`, background: 'var(--brand)' }} /></div><p>{percentage(Number(amount),s.totalInflow)} of recorded income</p></div>) : <p className="insight-box">No recorded income in this period. Percentage comparisons are unavailable.</p>}<p className="text-sm">Needs and Wants are gross debits. Refunds, loans and cash retained are shown separately; investment contributions alone are not your savings rate.</p></div>
    </div>
    {month ? <AdvancedInsights transactions={all} month={month} today={today} comparisonReady={coverage!.ready} /> : <p className="insight-box section">Choose a month to see payment patterns and period comparisons.</p>}
    <div className="card table-scroll"><h2>Recent transactions ? {scope}</h2><table className="data-table"><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Category</th></tr></thead><tbody>{rows.slice(0,10).map(t => <tr key={t.id}><td>{t.date}</td><td><details><summary>{displayMerchant(t.description)}</summary><p>{t.description}</p></details></td><td>{t.type === 'credit' ? '+' : '?'}{money(t.amount)}</td><td>{t.category}</td></tr>)}</tbody></table><Link className="text-link" href="/review">Review transaction categories ?</Link></div>
  </div>;
}
