import type { Transaction } from './supabase';

export function displayMerchant(raw: string) {
  // Presentation only: preserve IDs, original data and existing grouping keys.
  return raw.replace(/^(?:UPI|POS|NEFT|IMPS|RTGS)[\s:-]+/i, '').trim()
    .split(/\s+/).map(word => /^[A-Z]{1,3}$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}
export function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
export function todayInIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function periodRows(rows: Transaction[], month: string | null, today: string) {
  return rows.filter(t => t.date <= today && (!month || t.date.startsWith(month)));
}
export function percentage(value: number, total: number) {
  return total > 0 ? `${(value / total * 100).toFixed(1)}%` : 'N/A';
}
