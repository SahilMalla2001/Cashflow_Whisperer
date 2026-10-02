import { isIsoDate } from './transaction-domain';
export interface StatementMetadata {
  opening_balance: number | null;
  closing_balance: number | null;
  statement_start: string | null;
  statement_end: string | null;
}

export const emptyMetadata = (): StatementMetadata => ({ opening_balance: null, closing_balance: null, statement_start: null, statement_end: null });

// Conflicting chunks cannot establish trustworthy statement-level balances.
export function mergeMetadata(parts: StatementMetadata[]): StatementMetadata {
  const result = emptyMetadata();
  const amount = (key: 'opening_balance' | 'closing_balance') => {
    const values = [...new Set(parts.map(p => p?.[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e10).map(v => Math.round(v * 100) / 100))];
    return values.length === 1 ? values[0] : null;
  };
  const date = (key: 'statement_start' | 'statement_end') => {
    const values = [...new Set(parts.map(p => p?.[key]).filter(isIsoDate))];
    return values.length === 1 ? values[0] : null;
  };
  result.opening_balance = amount('opening_balance');
  result.closing_balance = amount('closing_balance');
  result.statement_start = date('statement_start');
  result.statement_end = date('statement_end');
  if (result.statement_start && result.statement_end && result.statement_start > result.statement_end) {
    result.statement_start = result.statement_end = null;
  }
  return result;
}
