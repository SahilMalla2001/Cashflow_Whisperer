import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import type { Transaction } from './supabase';
import { summarize } from './insights';
import { advancedInsights } from './advanced-insights';

export const advisorTools: ChatCompletionTool[] = [{ type: 'function', function: {
  name: 'query_finances',
  description: 'Query the signed-in user imported transactions. Use summary for totals across any date range, transactions for paginated rows, patterns for recurring/unusual purchases. Call separately for each comparison period. No access to bank balances or unimported records.',
  parameters: { type: 'object', additionalProperties: false, required: ['view', 'start', 'end'], properties: {
    view: { type: 'string', enum: ['summary', 'transactions', 'patterns'] },
    start: { type: 'string', description: 'Inclusive YYYY-MM-DD' },
    end: { type: 'string', description: 'Inclusive YYYY-MM-DD; patterns use this month' },
    merchant: { type: 'string', description: 'Optional literal description substring' },
    account_id: { type: 'string', description: 'Optional account UUID from a previous result' },
    offset: { type: 'integer', minimum: 0, description: 'Row offset for transactions, page size 30' },
  } },
} }];

export function executeFinanceTool(transactions: Transaction[], name: string, raw: string) {
  if (name !== 'query_finances') return { error: 'Unknown tool' };
  let args;
  try { args = JSON.parse(raw); } catch { return { error: 'Invalid JSON arguments' }; }
  const validDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  if (!args || !validDate(args.start) || !validDate(args.end) || args.start > args.end || !['summary', 'transactions', 'patterns'].includes(args.view)) return { error: 'Supply a valid view and inclusive date range' };
  if (args.merchant !== undefined && (typeof args.merchant !== 'string' || args.merchant.length > 120)) return { error: 'Invalid merchant filter' };
  if (args.account_id !== undefined && (typeof args.account_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(args.account_id))) return { error: 'Invalid account ID' };
  if (args.offset !== undefined && (!Number.isInteger(args.offset) || args.offset < 0)) return { error: 'Invalid offset' };
  const eligible = transactions.filter(t => (!args.merchant || t.description.toLowerCase().includes(args.merchant.toLowerCase())) && (!args.account_id || t.account_id === args.account_id));
  const rows = eligible.filter(t => t.date >= args.start && t.date <= args.end);
  const coverage = { count: rows.length, start: args.start, end: args.end, completeness: 'Not established. Missing imports are not zero spending.' };
  if (args.view === 'patterns') {
    const patterns = advancedInsights(eligible, args.end.slice(0, 7), args.end);
    return { coverage, patterns: { ...patterns, recurring: patterns.recurring.slice(0, 10), upcoming: patterns.upcoming.slice(0, 10), recurringCount: patterns.recurring.length, upcomingCount: patterns.upcoming.length }, note: 'Patterns use history up to end, including before start. Candidate lists show at most 10 entries; total includes all candidates. Candidates are not confirmed bills.' };
  }
  if (args.view === 'transactions') {
    const offset = args.offset ?? 0;
    return { coverage, nextOffset: offset + 30 < rows.length ? offset + 30 : null,
      rows: rows.slice(offset, offset + 30).map(({ date, description, amount, type, category, account_id }) => ({ date, description, amount, type, category, account_id })) };
  }
  const categories: Record<string, number> = {};
  for (const row of rows) if (row.type === 'debit') categories[row.category] = (categories[row.category] ?? 0) + Math.round(Number(row.amount) * 100);
  return { coverage, summary: summarize(rows), grossDebitsByCategory: Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v / 100])), note: 'savings means income remaining after spending, loans and investments, not bank balance or net worth.' };
}
