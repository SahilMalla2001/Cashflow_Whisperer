import type { ParsedTransaction } from "@/lib/groq";
import type { Transaction } from "@/lib/supabase";

const CATEGORIES = ["Needs", "Wants", "Savings", "Income", "Loan", "Transfer", "Refund"] as const;
const TYPES = ["credit", "debit"] as const;

type Category = (typeof CATEGORIES)[number];
type TransactionInput = Omit<Transaction, "id" | "created_at" | "statement_id" | "user_id">;

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
}

/**
 * Treat LLM output as untrusted input. A statement is only committed when every
 * extracted row matches the database contract and can be represented safely.
 */
export function validateTransactions(
  transactions: unknown[],
  source: Transaction["source"],
  cardName: string | null
): { rows: TransactionInput[]; errors: string[] } {
  const errors: string[] = [];
  const normalizedCardName = cardName ? cleanText(cardName, 160) : null;
  const rows: TransactionInput[] = [];

  transactions.forEach((transaction, index) => {
    const item = transaction as Partial<ParsedTransaction>;
    const description = cleanText(item.description, 500);
    const subcategory = cleanText(item.subcategory, 120) ?? "Uncategorized";
    const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);

    if (!isIsoDate(item.date)) errors.push(`row ${index + 1}: invalid date`);
    if (!description) errors.push(`row ${index + 1}: invalid description`);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      errors.push(`row ${index + 1}: invalid amount`);
    }
    if (!TYPES.includes(item.type as (typeof TYPES)[number])) errors.push(`row ${index + 1}: invalid type`);
    if (!CATEGORIES.includes(item.category as Category)) errors.push(`row ${index + 1}: invalid category`);

    if (
      isIsoDate(item.date) &&
      description &&
      Number.isFinite(amount) && amount > 0 && amount <= 10_000_000 &&
      TYPES.includes(item.type as (typeof TYPES)[number]) &&
      CATEGORIES.includes(item.category as Category)
    ) {
      rows.push({
        date: item.date,
        description,
        amount: Math.round(amount * 100) / 100,
        type: item.type as Transaction["type"],
        category: item.category as Transaction["category"],
        subcategory,
        source,
        card_name: source === "credit" ? normalizedCardName : null,
      });
    }
  });

  return { rows, errors };
}
