export const dynamic = "force-dynamic";

import { getTransactions } from "@/lib/supabase";
import { formatCurrency, pct } from "@/lib/utils";
import { summarize } from "@/lib/insights";
import { MonthlyInsights } from "@/components/MonthlyInsights";
import { DashboardCharts } from "@/components/DashboardCharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  AlertCircle,
  Sparkles,
} from "lucide-react";



export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const requestedMonth = (await searchParams).month;
  const month = typeof requestedMonth === "string" && /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(requestedMonth)
    ? requestedMonth
    : undefined;
  const range = month ? (() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return { startDate: `${month}-01`, endDate: `${month}-${lastDay}` };
  })() : undefined;
  const allTransactions = await getTransactions();
  const txns = range ? allTransactions.filter(t => t.date >= range.startDate && t.date <= range.endDate) : allTransactions;
  const summary = summarize(txns);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const insightMonth = month ?? allTransactions[0]?.date.slice(0, 7) ?? today.slice(0, 7);

  const { totalInflow, totalOutflow, savings, savingsRate, needs, wants, savingsCategory } = summary;

  // 50/30/20 benchmarks
  const needs50 = totalInflow * 0.5;
  const wants30 = totalInflow * 0.3;
  const savings20 = totalInflow * 0.2;

  // Recent 10 transactions for mini-feed
  const recent = txns.slice(0, 10);

  // Monthly aggregation for chart
  const monthlyMap: Record<string, { inflow: number; outflow: number }> = {};
  for (const t of txns) {
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!monthlyMap[month]) monthlyMap[month] = { inflow: 0, outflow: 0 };
    const totals = summarize([t]);
    monthlyMap[month].inflow += totals.totalInflow;
    monthlyMap[month].outflow += totals.totalOutflow;
  }
  const chartData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, vals]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      Inflow: vals.inflow,
      Outflow: vals.outflow,
    }));

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Your financial snapshot at a glance</p>
        </div>
        <form action="/" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            aria-label="Filter dashboard by month"
            className="input"
            defaultValue={month}
            name="month"
            type="month"
          />
          <button className="btn btn-primary btn-sm" type="submit">Apply</button>
        </form>
      </div>

      {/* Summary Stats */}
      <div className="grid-4 section">
        <div className="stat-card">
          <div className="stat-label">
            <TrendingUp size={12} />
            Total Inflow
          </div>
          <div className="stat-value positive">{formatCurrency(totalInflow)}</div>
          <div className="stat-sub">{month ? `Income in ${month}` : "All imported statements"}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <TrendingDown size={12} />
            Total Outflow
          </div>
          <div className="stat-value negative">{formatCurrency(totalOutflow)}</div>
          <div className="stat-sub">Spending + loans − refunds</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Wallet size={12} />
            Cash Remaining
          </div>
          <div className={`stat-value ${savings >= 0 ? "positive" : "negative"}`}>
            {formatCurrency(Math.abs(savings))}
          </div>
          <div className="stat-sub">{savings >= 0 ? "Surplus" : "Deficit"}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <PiggyBank size={12} />
            Cash Remaining / Income
          </div>
          <div className={`stat-value ${savingsRate >= 20 ? "positive" : "negative"}`}>
            {savingsRate.toFixed(1)}%
          </div>
          <div className="stat-sub">After spending, loans and investments</div>
        </div>
      </div>

      {/* Charts + 50/30/20 Grid */}
      <div className="grid-2 section">
        {/* Cash Flow Chart */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">Monthly Cash Flow</div>
          </div>
          {chartData.length > 0 ? (
            <DashboardCharts data={chartData} />
          ) : (
            <div className="empty-state">
              <AlertCircle size={32} />
              <h3>No data yet</h3>
              <p>Upload a PDF statement to see your cash flow chart</p>
            </div>
          )}
        </div>

        {/* 50/30/20 Audit */}
        <div className="card">
          <div className="section-header">
            <div className="section-title">
              <Sparkles size={14} />
              50 / 30 / 20 Rule Audit
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* Needs */}
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: "0.8125rem" }}>
                <span style={{ fontWeight: 500 }}>Needs (50%)</span>
                <span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(needs)}</span>
                  <span className="text-muted"> / {formatCurrency(needs50)}</span>
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${needs > needs50 ? "red" : "green"}`}
                  style={{ width: `${pct(needs, needs50)}%` }}
                />
              </div>
              <div style={{ fontSize: "0.72rem", marginTop: "4px", color: "var(--text-muted)" }}>
                {pct(needs, totalInflow)}% of income
                {needs > needs50 && (
                  <span style={{ color: "var(--negative)", marginLeft: "8px" }}>
                    ↑ Over by {formatCurrency(needs - needs50)}
                  </span>
                )}
              </div>
            </div>

            {/* Wants */}
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: "0.8125rem" }}>
                <span style={{ fontWeight: 500 }}>Wants (30%)</span>
                <span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(wants)}</span>
                  <span className="text-muted"> / {formatCurrency(wants30)}</span>
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${wants > wants30 ? "red" : "green"}`}
                  style={{ width: `${pct(wants, wants30)}%` }}
                />
              </div>
              <div style={{ fontSize: "0.72rem", marginTop: "4px", color: "var(--text-muted)" }}>
                {pct(wants, totalInflow)}% of income
                {wants > wants30 && (
                  <span style={{ color: "var(--negative)", marginLeft: "8px" }}>
                    ↑ Over by {formatCurrency(wants - wants30)}
                  </span>
                )}
              </div>
            </div>

            {/* Savings */}
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: "0.8125rem" }}>
                <span style={{ fontWeight: 500 }}>Savings / Invest (20%)</span>
                <span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(savingsCategory)}</span>
                  <span className="text-muted"> / {formatCurrency(savings20)}</span>
                </span>
              </div>
              <div className="progress-bar">
                <div
                  className={`progress-fill ${savingsCategory >= savings20 ? "green" : "yellow"}`}
                  style={{ width: `${pct(savingsCategory, savings20)}%` }}
                />
              </div>
              <div style={{ fontSize: "0.72rem", marginTop: "4px", color: "var(--text-muted)" }}>
                {pct(savingsCategory, totalInflow)}% of income
              </div>
            </div>
          </div>
        </div>
      </div>

      <MonthlyInsights transactions={allTransactions} month={insightMonth} today={today} />
      <div className="grid-2 section">
        {/* Recent Transactions */}
        <div>
          <div className="section-header">
            <div className="section-title">Recent Transactions</div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {recent.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td className="truncate" style={{ maxWidth: "160px" }}>
                        {t.description}
                      </td>
                      <td>
                        <span style={{
                          color: t.type === "credit" ? "var(--positive)" : "var(--text-primary)",
                          fontWeight: 600,
                          fontSize: "0.8125rem",
                          fontFamily: "var(--font-mono, monospace)",
                        }}>
                          {t.type === "credit" ? "+" : "−"}
                          {formatCurrency(t.amount)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          t.category === "Income" ? "badge-green" :
                          t.category === "Wants" ? "badge-yellow" :
                          t.category === "Loan" ? "badge-red" : ""
                        }`}>
                          {t.category}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <AlertCircle size={28} />
                <h3>No transactions</h3>
                <p>Upload a statement to see data here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
