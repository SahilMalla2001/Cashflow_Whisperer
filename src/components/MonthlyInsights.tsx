import { monthlyInsights } from '@/lib/insights';
import type { Transaction } from '@/lib/supabase';
import { formatCurrency as money } from '@/lib/utils';
import { monthLabel, displayMerchant } from '@/lib/presentation';

export function MonthlyInsights({ transactions, month, today, coverage }: { transactions: Transaction[]; month: string; today: string; coverage: { ready: boolean; reason: string } }) {
  const insight = monthlyInsights(transactions, month, today, coverage.ready);
  const ready = coverage.ready && insight.comparable;
  const change = insight.current.totalOutflow - insight.prior.totalOutflow;
  return <section className="section"><h2>{monthLabel(month)} ? recorded activity</h2>
    <div className="insight-box section"><h3>{ready ? `Recorded spending ${change < 0 ? 'fell' : change > 0 ? 'rose' : 'was unchanged'}${change ? ` by ${money(Math.abs(change))}` : ''}` : 'More coverage is needed before comparing spending'}</h3><p>{ready ? `${month} compared with ${insight.previous}, using the same day cutoff where applicable.` : coverage.reason}</p></div>
    <div className="grid-2 section">{[['Recorded income', insight.current.totalInflow], ['Spending and loans, net of refunds', insight.current.totalOutflow]].map(([label,value]) => <div className="card" key={String(label)}><h3>{label}</h3><div className="stat-value">{money(Number(value))}</div></div>)}</div>
    <details className="card section"><summary>Coverage and calculation details</summary><p>{month}: {insight.coverage}<br />{insight.previous}: {insight.previousCoverage}</p><p>Day cutoff: {insight.cutoff}. Transaction dates do not establish statement completeness. Raw prior-period income: {money(insight.prior.totalInflow)}; spending and loans: {money(insight.prior.totalOutflow)}.</p></details>
    <div className="grid-2 section">{[{title:'Category purchases',entries:insight.categories,merchant:false},{title:'Merchant purchases',entries:insight.merchants,merchant:true}].map(group => <div className="card table-scroll" key={group.title}><h3>{group.title}</h3><p>Gross Needs/Wants purchases. {ready ? 'Five largest changes.' : 'Five largest current totals; comparison withheld.'}</p><table className="data-table"><thead><tr><th>Name</th><th>Selected period</th>{ready && <th>Change</th>}</tr></thead><tbody>{group.entries.map(item => <tr key={item.name}><td>{group.merchant ? <details><summary>{displayMerchant(item.name)}</summary><p>{item.name}</p></details> : item.name}</td><td>{money(item.amount)}</td>{ready && <td>{item.change > 0 ? '+' : ''}{money(item.change)}</td>}</tr>)}</tbody></table></div>)}</div>
    <div className="grid-3 section">{[['Loan payments',insight.current.loanPayments],['Investment contributions',insight.current.savingsCategory],['Refund credits',insight.current.refunds]].map(([label,value]) => <div className="card" key={String(label)}><h3>{label}</h3><p>{money(Number(value))}</p></div>)}</div>
  </section>;
}
