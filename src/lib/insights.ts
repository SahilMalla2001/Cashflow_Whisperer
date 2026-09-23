import type { Transaction } from "./supabase";

export function summarize(transactions: Transaction[]) {
  const totals = { totalInflow: 0, totalOutflow: 0, needs: 0, wants: 0, savingsCategory: 0, transfers: 0, loanPayments: 0, refunds: 0 };
  for (const t of transactions) {
    const amount = Math.round(Number(t.amount) * 100);
    if (t.type === "credit") {
      if (t.category === "Income") totals.totalInflow += amount;
      if (t.category === "Refund") totals.refunds += amount;
      continue;
    }
    if (t.category === "Needs") totals.needs += amount;
    if (t.category === "Wants") totals.wants += amount;
    if (t.category === "Loan") totals.loanPayments += amount;
    if (t.category === "Savings") totals.savingsCategory += amount;
    if (t.category === "Transfer") totals.transfers += amount;
  }
  totals.totalOutflow = totals.needs + totals.wants + totals.loanPayments - totals.refunds;
  const savings = totals.totalInflow - totals.totalOutflow - totals.savingsCategory;
  const savingsRate = totals.totalInflow > 0 ? savings / totals.totalInflow * 100 : 0;
  return { ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / 100])) as typeof totals, savings: savings / 100, savingsRate };
}

export function monthlyInsights(transactions: Transaction[], month: string, today: string) {
  const [year, number] = month.split("-").map(Number);
  const previous = new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
  const cutoff = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : 31;
  const select = (value: string) => transactions.filter(t => t.date.startsWith(value) && Number(t.date.slice(8, 10)) <= cutoff);
  const currentRows = select(month);
  const previousRows = select(previous);
  const current = summarize(currentRows);
  const prior = summarize(previousRows);
  const groups = (rows: Transaction[], merchant: boolean) => {
    const result = new Map<string, number>();
    for (const t of rows) {
      if (t.type !== "debit" || !["Needs", "Wants"].includes(t.category)) continue;
      const key = merchant ? t.description.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN") : t.subcategory || t.category;
      result.set(key, (result.get(key) ?? 0) + Math.round(Number(t.amount) * 100));
    }
    return result;
  };
  const drivers = (merchant: boolean) => {
    const now = groups(currentRows, merchant);
    const before = groups(previousRows, merchant);
    return [...new Set([...now.keys(), ...before.keys()])].map(name => ({ name, amount: (now.get(name) ?? 0) / 100, change: ((now.get(name) ?? 0) - (before.get(name) ?? 0)) / 100 }))
      .sort((a, b) => previousRows.length ? b.change - a.change : b.amount - a.amount).slice(0, 5);
  };
  const coverage = (rows: Transaction[]) => {
    const dates = rows.map(t => t.date).sort();
    return dates.length ? `${dates[0]} to ${dates[dates.length - 1]} (${rows.length} transactions)` : "No imported transactions";
  };
  return { month, previous, cutoff, current, prior, comparable: currentRows.length > 0 && previousRows.length > 0, coverage: coverage(currentRows), previousCoverage: coverage(previousRows), categories: drivers(false), merchants: drivers(true) };
}
