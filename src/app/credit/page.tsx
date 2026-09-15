export const dynamic = "force-dynamic";

import { getDistinctCards, getTransactions } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { CreditCard, ArrowRight, Upload } from "lucide-react";

export default async function CreditPage() {
  const [cardNames, allCreditTxns] = await Promise.all([
    getDistinctCards(),
    getTransactions("credit"),
  ]);

  const totalCreditSpend = allCreditTxns
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Credit Cards</h1>
          <p>
            {cardNames.length > 0
              ? `${cardNames.length} card${cardNames.length > 1 ? "s" : ""} · Total spend across all cards`
              : "No credit card statements uploaded yet"}
          </p>
        </div>
        {cardNames.length > 0 && (
          <div className="stat-card" style={{ minWidth: "160px" }}>
            <div className="stat-label">Total CC Spend</div>
            <div className="stat-value negative">{formatCurrency(totalCreditSpend)}</div>
          </div>
        )}
      </div>

      {cardNames.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={40} />
          <h3>No credit cards yet</h3>
          <p>Upload a credit card statement PDF — the card name will be detected automatically</p>
          <Link href="/upload" className="btn btn-primary" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Upload size={14} /> Upload Statement
          </Link>
        </div>
      ) : (
        <div className="grid-2 section">
          {cardNames.map((cardName) => {
            const txns = allCreditTxns.filter((t) => t.card_name === cardName);
            const spend = txns.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
            const slug = encodeURIComponent(cardName);

            return (
              <Link key={cardName} href={`/credit/${slug}`} style={{ textDecoration: "none" }}>
                <div className="card card-hover" style={{ display: "flex", flexDirection: "column", gap: "16px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <CreditCard size={18} />
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{cardName}</span>
                    </div>
                    <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                  </div>

                  <div style={{ display: "flex", gap: "24px" }}>
                    <div>
                      <div className="stat-label">Total Spend</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{formatCurrency(spend)}</div>
                    </div>
                    <div>
                      <div className="stat-label">Transactions</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{txns.length}</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: "16px", fontSize: "0.775rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
        <Upload size={11} />
        Upload more credit card PDFs to add cards automatically
      </div>
    </div>
  );
}
