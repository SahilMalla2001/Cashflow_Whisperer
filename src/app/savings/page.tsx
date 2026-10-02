export const dynamic = "force-dynamic";

import { getTransactions, getAccounts } from "@/lib/supabase";
import { summarize } from "@/lib/insights";
import Link from "next/link";
import { displayMerchant } from "@/lib/presentation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Landmark } from "lucide-react";

export default async function SavingsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const [all, accounts] = await Promise.all([getTransactions("savings"), getAccounts()]);
  const txns = account ? all.filter(t => account === 'unassigned' ? !t.account_id : t.account_id === account) : all;
  const summary = summarize(txns);

  const totalCredit = txns.filter(t => t.type === "credit").reduce((s, t) => s + t.amount, 0);
  const totalDebit = txns.filter(t => t.type === "debit").reduce((s, t) => s + t.amount, 0);

  // Category breakdown
  const catMap: Record<string, number> = {};
  for (const t of txns) {
    if (t.type === "debit") {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Bank account activity</h1>
          <p>Bank statement transactions — HDFC / Axis</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{
            background: "color-mix(in srgb, var(--positive) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--positive) 20%, transparent)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 16px",
            fontSize: "0.8125rem",
          }}>
            <span className="text-muted">All credits: </span>
            <strong style={{ color: "var(--positive)" }}>{formatCurrency(totalCredit)}</strong>
          </div>
          <div style={{
            background: "color-mix(in srgb, var(--negative) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--negative) 20%, transparent)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 16px",
            fontSize: "0.8125rem",
          }}>
            <span className="text-muted">All debits: </span>
            <strong style={{ color: "var(--negative)" }}>{formatCurrency(totalDebit)}</strong>
          </div>
        </div>
      </div>

      <nav className="account-filters section"><Link className="filter-pill" href="/savings">All bank accounts</Link>{accounts.filter(a=>a.type==='savings').map(a=><Link className={`filter-pill ${account===a.id?'selected':''}`} key={a.id} href={`/savings?account=${a.id}`}>{a.name}</Link>)}<Link className="filter-pill" href="/savings?account=unassigned">Unassigned</Link></nav>
      <div className="grid-4 section">{[['Gross purchases',summary.needs+summary.wants],['Investment debits',summary.savingsCategory],['Transfer debits',summary.transfers],['Refund credits',summary.refunds]].map(([label,value])=><div className="stat-card" key={String(label)}><div className="stat-label">{label}</div><div className="stat-value">{formatCurrency(Number(value))}</div></div>)}</div>
      <p className="section">Transfers are money movements, not consumption. Gross purchases depend on categorization; refund credits are shown separately. <Link className="text-link" href="/review">Review categories ?</Link></p>
      {/* Category Bars */}
      {Object.keys(catMap).length > 0 && (
        <div className="card section">
          <div className="section-title" style={{ marginBottom: "16px" }}>Money out by type</div>
          {Object.entries(catMap)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amt]) => (
              <div key={cat} className="cat-bar">
                <div className="cat-bar-label">{cat}</div>
                <div className="cat-bar-track">
                  <div
                    className="cat-bar-fill"
                    style={{ width: `${Math.min(100, (amt / totalDebit) * 100)}%` }}
                  />
                </div>
                <div className="cat-bar-value">{formatCurrency(amt)}</div>
              </div>
            ))}
        </div>
      )}

      {/* Transaction Table */}
      <div className="card table-scroll" style={{ padding: 0 }}>
        {txns.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t) => (
                <tr key={t.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                    {formatDate(t.date)}
                  </td>
                  <td><details><summary>{displayMerchant(t.description)}</summary><p>{t.description}</p></details></td>
                  <td>
                    <span className={`badge ${
                      t.category === "Income" ? "badge-green" :
                      t.category === "Wants" ? "badge-yellow" :
                      t.category === "Loan" ? "badge-red" : ""
                    }`}>
                      {t.category}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                    {t.subcategory}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span style={{
                      fontWeight: 600,
                      fontFamily: "monospace",
                      fontSize: "0.8125rem",
                      color: t.type === "credit" ? "var(--positive)" : "var(--text-primary)",
                    }}>
                      {t.type === "credit" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <Landmark size={36} />
            <h3>No savings transactions</h3>
            <p>Upload your bank statement PDF to populate this view</p>
          </div>
        )}
      </div>
    </div>
  );
}
