import type { Transaction } from './supabase';
import { monthlyInsights } from './insights';

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const merchant = (t: Transaction) => t.description.trim().toLowerCase().replace(/\s+/g, ' ');
const identity = (t: Transaction) => `${t.account_id ?? t.card_name ?? t.source}|${merchant(t)}`;
const purchase = (t: Transaction) => t.type === 'debit' && ['Needs', 'Wants'].includes(t.category);

export function advancedInsights(transactions: Transaction[], month: string, today: string) {
  const monthly = monthlyInsights(transactions, month, today);
  const [year, number] = month.split('-').map(Number);
  const end = month === today.slice(0, 7) ? today : new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
  const history = transactions.filter(t => t.date <= end);
  const groups = new Map<string, Transaction[]>();
  for (const t of history) {
    if (t.type !== 'debit' || !['Needs', 'Wants', 'Loan'].includes(t.category)) continue;
    const key = identity(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const recurring = [...groups.entries()].flatMap(([key, values]) => {
    const rows = values.sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
    if (rows.length < 3) return [];
    const gaps = rows.slice(1).map((r, i) => day(r.date) - day(rows[i].date));
    // Conservative monthly candidates: multiple same-day purchases disqualify a group.
    if (!gaps.every(g => g >= 25 && g <= 35)) return [];
    const typical = median(rows.map(r => Number(r.amount)));
    if (!rows.every(r => Math.abs(Number(r.amount) - typical) <= Math.max(10, typical * .15))) return [];
    const last = rows[rows.length - 1];
    if (day(end) - day(last.date) > 40) return [];
    const lastDate = new Date(`${last.date}T00:00:00Z`);
    const nextMonth = lastDate.getUTCMonth() + 1;
    const nextDay = Math.min(lastDate.getUTCDate(), new Date(Date.UTC(lastDate.getUTCFullYear(), nextMonth + 1, 0)).getUTCDate());
    const nextDate = new Date(Date.UTC(lastDate.getUTCFullYear(), nextMonth, nextDay)).toISOString().slice(0, 10);
    return [{ key, name: last.description, amount: typical, observations: rows.length, confidence: rows.length >= 5 ? 'higher' : 'moderate', nextDate }];
  }).sort((a, b) => b.amount - a.amount);

  const current = history.filter(t => t.date.startsWith(month) && purchase(t));
  const prior = history.filter(t => t.date.startsWith(monthly.previous) && Number(t.date.slice(8, 10)) <= monthly.cutoff && purchase(t));
  const mean = (rows: Transaction[]) => rows.length ? rows.reduce((sum, t) => sum + Math.round(Number(t.amount) * 100), 0) / rows.length / 100 : null;
  const unusual = current.flatMap(t => {
    // Only earlier months form the baseline; never let the flagged month train itself.
    const past = history.filter(p => p.date < `${month}-01` && purchase(p) && identity(p) === identity(t)).map(p => Number(p.amount));
    if (past.length < 5) return [];
    const center = median(past);
    const mad = median(past.map(v => Math.abs(v - center)));
    const threshold = center + Math.max(3 * 1.4826 * mad, center, 500);
    return Number(t.amount) > threshold ? [{ id: t.id, name: t.description, date: t.date, amount: Number(t.amount), typical: center, observations: past.length }] : [];
  }).sort((a, b) => b.amount - a.amount).slice(0, 5);
  const upcoming = recurring.filter(r => day(r.nextDate) > day(end) && day(r.nextDate) <= day(end) + 35);
  return { recurring, unusual, upcoming, upcomingTotal: upcoming.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100,
    frequency: { current: current.length, prior: prior.length, average: mean(current), previousAverage: mean(prior) },
    monthly, asOf: end };
}
