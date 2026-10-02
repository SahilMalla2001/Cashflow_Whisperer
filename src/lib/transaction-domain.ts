export const CATEGORIES = ['Needs', 'Wants', 'Income', 'Loan', 'Savings', 'Transfer', 'Refund'] as const;
export type Category = (typeof CATEGORIES)[number];

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
