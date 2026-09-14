export const dynamic = "force-dynamic";

import { getTransactions } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import Link from "next/link";

const CARD_META: Record<string, { label: string; key: "credit_swiggy" | "credit_roarbank"; limit: number }> = {
  swiggy: { label: "HDFC Swiggy Credit Card", key: "credit_swiggy", limit: 100000 },
  roarbank: { label: "Roarbank Credit Card", key: "credit_roarbank", limit: 50000 },
};

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = CARD_META[slug];
  if (!meta) notFound();

  const txns = await getTransactions(meta.key);
  const debits = txns.filter((t) => t.type === "debit");
  const totalSpend = debits.reduce((s, t) => s + t.amount, 0);
  const utilization = Math.min(100, (totalSpend / meta.limit) * 100);

  // Top categories
  const catMap: Record<string, number> = {};
  for (const t of debits) {
    catMap[t.subcategory] = (catMap[t.subcategory] ?? 0) + t.amount;
  }
  const topCats = Object.entries(catMap).sort(([, a], [, b]) => b - a).slice(0, 6);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <Link
            href="/credit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.8125rem",
              color: "var(--text-muted)",
              marginBottom: "8px",
              textDecoration: "none",
            }}
          >
            <ArrowLeft size={14} />
            Back to Credit Cards
          </Link>
          <h1>{meta.label}</h1>
          <p>Limit: {formatCurrency(meta.limit)}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3 section">
        <div className="stat-card">
          <div className="stat-label"><CreditCard size={12} /> Total Spend</div>
          <div className="stat-value negative">{formatCurrency(totalSpend)}</div>
          <div className="stat-sub">{txns.length} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Utilization</div>
          <div className={`stat-value ${utilization > 30 ? "negative" : "positive"}`}>
            {utilization.toFixed(1)}%
          </div>
          <div className="stat-sub">{utilization > 30 ? "High — may hurt score" : "Healthy range"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Transaction</div>
          <div className="stat-value">
            {debits.length ? formatCurrency(totalSpend / debits.length) : "—"}
          </div>
          <div className="stat-sub">Per transaction</div>
        </div>
      </div>

      <div className="grid-2 section">
        {/* Utilization visual */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: "16px" }}>Credit Utilization</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, letterSpacing: "-0.04em", marginBottom: "12px" }}>
            {utilization.toFixed(1)}%
          </div>
          <div className="progress-bar" style={{ height: "10px" }}>
            <div
              className={`progress-fill ${utilization > 30 ? "red" : "green"}`}
              style={{ width: `${utilization}%` }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            <span>{formatCurrency(totalSpend)} used</span>
            <span>{formatCurrency(meta.limit - totalSpend)} available</span>
          </div>
        </div>

        {/* Top subcategories */}
        <div className="card">
          <div className="section-title" style={{ marginBottom: "16px" }}>Top Spending Categories</div>
          {topCats.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {topCats.map(([cat, amt]) => (
                <div key={cat} className="cat-bar">
                  <div className="cat-bar-label">{cat}</div>
                  <div className="cat-bar-track">
                    <div className="cat-bar-fill" style={{ width: `${(amt / totalSpend) * 100}%` }} />
                  </div>
                  <div className="cat-bar-value">{formatCurrency(amt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No data</p>
          )}
        </div>
      </div>

      {/* Full transaction table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {txns.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
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
                  <td style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>{t.subcategory}</td>
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
            <h3>No transactions for this card</h3>
            <p>Upload a statement PDF to populate this view</p>
          </div>
        )}
      </div>
    </div>
  );
}
