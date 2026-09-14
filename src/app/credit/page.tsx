export const dynamic = "force-dynamic";

import { getTransactions } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { CreditCard, ArrowRight, AlertCircle } from "lucide-react";

const CARDS = [
  { key: "credit_swiggy", label: "HDFC Swiggy CC", slug: "swiggy", limit: 100000 },
  { key: "credit_roarbank", label: "Roarbank CC", slug: "roarbank", limit: 50000 },
] as const;

export default async function CreditPage() {
  const allCredit = await getTransactions();
  const creditTxns = allCredit.filter((t) =>
    t.source === "credit_swiggy" || t.source === "credit_roarbank"
  );

  const totalSpend = creditTxns
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  const totalPaid = creditTxns
    .filter((t) => t.type === "credit")
    .reduce((s, t) => s + t.amount, 0);

  const outstanding = totalSpend - totalPaid;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Credit Cards</h1>
          <p>Swiggy CC &amp; Roarbank CC — combined view</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid-3 section">
        <div className="stat-card">
          <div className="stat-label"><CreditCard size={12} /> Total Spend</div>
          <div className="stat-value negative">{formatCurrency(totalSpend)}</div>
          <div className="stat-sub">Across all cards</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Paid</div>
          <div className="stat-value positive">{formatCurrency(totalPaid)}</div>
          <div className="stat-sub">Payments made</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Outstanding</div>
          <div className={`stat-value ${outstanding > 0 ? "negative" : "positive"}`}>
            {formatCurrency(Math.abs(outstanding))}
          </div>
          <div className="stat-sub">{outstanding > 0 ? "Balance due" : "No balance"}</div>
        </div>
      </div>

      {/* Card tiles */}
      <div className="grid-2 section">
        {CARDS.map(({ key, label, slug, limit }) => {
          const cardTxns = creditTxns.filter((t) => t.source === key);
          const spent = cardTxns.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
          const utilization = Math.min(100, (spent / limit) * 100);

          return (
            <Link href={`/credit/${slug}`} key={slug} style={{ textDecoration: "none" }}>
              <div className="card" style={{ cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>{label}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {cardTxns.length} transactions
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: "var(--text-muted)", marginTop: "3px" }} />
                </div>

                <div style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.03em", marginBottom: "12px" }}>
                  {formatCurrency(spent)}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                    <span>Credit Utilization</span>
                    <span style={{ fontWeight: 600, color: utilization > 30 ? "var(--negative)" : "var(--positive)" }}>
                      {utilization.toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${utilization > 30 ? "red" : "green"}`}
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Limit: {formatCurrency(limit)}
                  </div>
                </div>

                {utilization > 30 && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.75rem",
                    color: "var(--warning)",
                    marginTop: "10px",
                  }}>
                    <AlertCircle size={12} />
                    High utilization may affect credit score
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Recent credit transactions */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">Recent Credit Transactions</div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {creditTxns.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Card</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {creditTxns.slice(0, 20).map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                      {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="truncate" style={{ maxWidth: "200px" }}>{t.description}</td>
                    <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      {t.source === "credit_swiggy" ? "Swiggy CC" : "Roarbank"}
                    </td>
                    <td>
                      <span className={`badge ${
                        t.category === "Wants" ? "badge-yellow" :
                        t.category === "Needs" ? "" :
                        "badge-green"
                      }`}>{t.category}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{
                        fontWeight: 600,
                        fontFamily: "monospace",
                        fontSize: "0.8125rem",
                        color: t.type === "credit" ? "var(--positive)" : "var(--text-primary)",
                      }}>
                        {t.type === "credit" ? "+" : "−"}{formatCurrency(t.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <CreditCard size={36} />
              <h3>No credit card data</h3>
              <p>Upload a credit card statement PDF to see transactions here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
