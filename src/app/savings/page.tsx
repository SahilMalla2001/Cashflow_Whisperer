export const dynamic = "force-dynamic";

import { getTransactions } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertCircle, Landmark } from "lucide-react";

export default async function SavingsPage() {
  const txns = await getTransactions("savings");

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
          <h1>Savings Account</h1>
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
            <span className="text-muted">In: </span>
            <strong style={{ color: "var(--positive)" }}>{formatCurrency(totalCredit)}</strong>
          </div>
          <div style={{
            background: "color-mix(in srgb, var(--negative) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--negative) 20%, transparent)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 16px",
            fontSize: "0.8125rem",
          }}>
            <span className="text-muted">Out: </span>
            <strong style={{ color: "var(--negative)" }}>{formatCurrency(totalDebit)}</strong>
          </div>
        </div>
      </div>

      {/* Category Bars */}
      {Object.keys(catMap).length > 0 && (
        <div className="card section">
          <div className="section-title" style={{ marginBottom: "16px" }}>Spending by Category</div>
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
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
                  <td className="truncate" style={{ maxWidth: "240px" }}>{t.description}</td>
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
