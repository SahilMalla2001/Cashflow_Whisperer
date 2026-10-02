import type { Statement, Transaction } from './supabase';

export function comparisonCoverage(rows: Transaction[], statements: Statement[], month: string, today: string) {
  const [year, number] = month.split('-').map(Number);
  const previous = new Date(Date.UTC(year, number - 2, 1)).toISOString().slice(0, 7);
  const cutoff = month === today.slice(0, 7) ? Number(today.slice(8)) : 31;
  const end = (m: string) => {
    const [y, n] = m.split('-').map(Number);
    return `${m}-${String(Math.min(cutoff, new Date(Date.UTC(y, n, 0)).getUTCDate())).padStart(2, '0')}`;
  };
  const relevant = rows.filter(t => t.date >= `${previous}-01` && t.date <= end(month));
  const accounts = new Set(rows.filter(t => t.date <= end(month)).map(t => t.account_id).filter(Boolean));
  if (!accounts.size || relevant.some(t => !t.account_id)) return { ready: false, reason: 'Some records have no account assignment. Complete account coverage cannot be established.' };
  for (const account of accounts) for (const period of [previous, month]) {
    const ranges = statements.filter(s => s.account_id === account && s.status === 'complete' && s.reconciliation?.status === 'matched' && !s.reconciliation.possible_overlap_count)
      .map(s => s.reconciliation!).filter(r => r.statement_start && r.statement_end)
      .sort((a, b) => a.statement_start!.localeCompare(b.statement_start!));
    let next = `${period}-01`;
    for (const range of ranges) {
      if (range.statement_start! > next) break;
      if (range.statement_end! >= next) next = new Date(Date.parse(`${range.statement_end}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    }
    if (next <= end(period)) return { ready: false, reason: 'Both periods need dated, reconciled statements for every imported account. A missing card or bank statement can change the comparison.' };
  }
  return { ready: true, reason: 'Statement periods and extracted balances support this comparison. Categorization and overlapping imports still need review.' };
}
