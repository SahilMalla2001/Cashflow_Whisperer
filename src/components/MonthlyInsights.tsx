import { monthlyInsights } from "@/lib/insights";
import type { Transaction } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export function MonthlyInsights({ transactions, month, today }: { transactions: Transaction[]; month: string; today: string }) {
  const insight = monthlyInsights(transactions, month, today);
  const delta = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatCurrency(Math.abs(value))}`;
  return <section className="section">
    <h2>Monthly insights · {month}</h2>
    <p>{insight.cutoff < 31 ? `Month to date through day ${insight.cutoff}; previous month uses the same day cutoff.` : "Calendar-month comparison."} Based on imported transactions; statement completeness is not verified.</p>
    <p style={{ fontSize: "0.8rem", margin: "8px 0 16px" }}>{month}: {insight.coverage}<br />{insight.previous}: {insight.previousCoverage}</p>
    {insight.comparable ? <div className="grid-2 section">
      {[["Income", insight.current.totalInflow, insight.prior.totalInflow], ["Spending and loan payments, net of refunds", insight.current.totalOutflow, insight.prior.totalOutflow]].map(([label, amount, prior]) => <div className="card" key={String(label)}>
        <h3>{label}</h3><div className="stat-value">{formatCurrency(Number(amount))}</div>
        <p>{delta(Number(amount) - Number(prior))} vs {insight.previous}{Number(prior) > 0 ? ` (${((Number(amount) - Number(prior)) / Number(prior) * 100).toFixed(1)}%)` : " (no positive baseline for percentage)"}</p>
      </div>)}
    </div> : <p className="insight-box">Import transactions for both months to compare changes. Missing data is not treated as zero spending.</p>}
    <div className="grid-2 section">
      {[["Category spending drivers", insight.categories], ["Merchant / description spending drivers", insight.merchants]].map(([title, entries]) => <div className="card" key={String(title)}>
        <h3>{String(title)}</h3>
        <p style={{ fontSize: "0.8rem" }}>Purchases only; loans, investments and transfers excluded. Refunds are shown separately. {insight.comparable ? "Sorted by largest increase." : "Sorted by amount."}</p>
        <div style={{ overflowX: "auto" }}><table className="data-table"><thead><tr><th>Name</th><th>This month</th>{insight.comparable && <th>Change</th>}</tr></thead><tbody>
          {(entries as typeof insight.categories).map(item => <tr key={item.name}><td style={{ overflowWrap: "anywhere" }}>{item.name}</td><td>{formatCurrency(item.amount)}</td>{insight.comparable && <td>{delta(item.change)}</td>}</tr>)}
        </tbody></table></div>
        {(entries as typeof insight.categories).length === 0 && <p>No purchases in this period.</p>}
      </div>)}
    </div>
    <div className="grid-3 section">
      {[["Loan payments", insight.current.loanPayments], ["Investment contributions", insight.current.savingsCategory], ["Refunds received", insight.current.refunds]].map(([label, amount]) => <div className="card" key={String(label)}><h3>{label}</h3><p>{formatCurrency(Number(amount))}</p></div>)}
    </div>
    <p style={{ fontSize: "0.8rem" }}>Merchant descriptions are grouped by matching text, ignoring case and extra spaces. Variations may appear separately. Existing categorization errors or overlapping imports can affect these figures.</p>
  </section>;
}
