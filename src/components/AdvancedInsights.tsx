import { advancedInsights } from '@/lib/advanced-insights';
import type { Transaction } from '@/lib/supabase';
import { formatCurrency as money } from '@/lib/utils';

export function AdvancedInsights({ transactions, month, today }: { transactions: Transaction[]; month: string; today: string }) {
  const insights = advancedInsights(transactions, month, today);
  const { current } = insights.monthly;
  return <section className="section">
    <h2>Patterns and commitments</h2>
    <p>As of {insights.asOf}. Estimates use imported history; missing statements and overlapping imports can affect results.</p>
    <div className="grid-3 section">
      <div className="card"><h3>Investment contributions</h3><p>{money(current.savingsCategory)}</p><p>Recorded investment debits, not investment returns.</p></div>
      <div className="card"><h3>Income left after outgoings</h3><p>{money(current.savings)}</p><p>After spending, loans and investments. This is not an available bank balance.</p></div>
      <div className="card"><h3>Likely commitments · next 35 days</h3><p>{money(insights.upcomingTotal)}</p><p>{insights.upcoming.length} recurring candidates. An estimate, not confirmed bills or a complete forecast.</p></div>
    </div>
    <div className="grid-2 section">
      <div className="card"><h3>Likely monthly payments</h3><p>At least three payments, 25–35 days apart, with similar amounts. Confirm these against your bills.</p>
        {insights.recurring.length === 0 ? <p>Not enough consistent history to identify monthly payments.</p> : <ul>{insights.recurring.slice(0, 10).map(r => <li key={r.key}>{r.name}: {money(r.amount)} · expected {r.nextDate} · {r.observations} observations ({r.confidence} confidence)</li>)}</ul>}
      </div>
      <div className="card"><h3>Unusual purchase amounts</h3><p>Compared with at least five earlier purchases with the same description and account. These are review prompts, not fraud alerts.</p>
        {insights.unusual.length === 0 ? <p>No flagged purchases, or insufficient history for comparison.</p> : <ul>{insights.unusual.map(r => <li key={r.id}>{r.date} · {r.name}: {money(r.amount)} vs a typical {money(r.typical)}</li>)}</ul>}
      </div>
    </div>
    <div className="card"><h3>More purchases or bigger purchases?</h3>
      <p>{insights.frequency.current} purchases this period; average {insights.frequency.average === null ? 'unavailable' : money(insights.frequency.average)}.</p>
      {insights.monthly.comparable && <p>Previous comparable period: {insights.frequency.prior} purchases; average {insights.frequency.previousAverage === null ? 'unavailable' : money(insights.frequency.previousAverage)}.</p>}
      <p>Gross Needs/Wants purchases only; refunds, transfers, investments and loan payments are excluded.</p>
    </div>
  </section>;
}
