// Re-export the SSR server client factory for convenience.
export { createClient } from "@/utils/supabase/server";

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: "Needs" | "Wants" | "Savings" | "Income" | "Loan" | "Transfer" | "Refund";
  subcategory: string;
  source: "savings" | "credit";
  card_name: string | null;
  statement_id: string | null;
  account_id?: string | null;
  created_at: string;
}

export interface Statement {
  id: string;
  user_id: string;
  file_hash: string;
  filename: string;
  file_size: number;
  source: Transaction["source"];
  card_name: string | null;
  status: "processing" | "complete" | "failed";
  transaction_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export async function getTransactions(
  source?: Transaction["source"],
  range?: DateRange
): Promise<Transaction[]> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const rows: Transaction[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from("transactions").select("*")
      .order("date", { ascending: false }).order("id")
      .range(offset, offset + pageSize - 1);
    if (source) query = query.eq("source", source);
    if (range?.startDate) query = query.gte("date", range.startDate);
    if (range?.endDate) query = query.lte("date", range.endDate);
    const { data, error } = await query;
    if (error) throw new Error("Unable to load transactions. Please retry.");
    rows.push(...(data ?? []) as Transaction[]);
    if (!data || data.length < pageSize) return rows;
  }
}

export async function getTransactionsByCard(cardName: string): Promise<Transaction[]> {
  return (await getTransactions('credit')).filter(t => t.card_name === cardName);
}

export async function getDistinctCards(): Promise<string[]> {
  return [...new Set((await getTransactions('credit')).map(t => t.card_name))]
    .filter((name): name is string => Boolean(name));
}

export async function getSummary(range?: DateRange) {
  const { summarize } = await import("./insights");
  return summarize(await getTransactions(undefined, range));
}

export async function reserveStatement(input: {
  user_id: string;
  file_hash: string;
  filename: string;
  file_size: number;
  source: Transaction["source"];
}): Promise<{ statement: Statement; duplicate: boolean }> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("statements")
    .insert({ ...input, status: "processing" })
    .select()
    .single();
  if (!error) return { statement: data as Statement, duplicate: false };

  if (error.code === "23505") {
    const { data: existing, error: lookupError } = await supabase
      .from("statements")
      .select("*")
      .eq("file_hash", input.file_hash)
      .single();
    if (!lookupError && existing) return { statement: existing as Statement, duplicate: true };
  }
  throw new Error(error.message);
}

export async function discardStatement(statementId: string) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("statements").delete().eq("id", statementId).eq("status", "processing");
  if (error) console.error("discardStatement error:", error.message);
}

export async function finalizeStatement(statementId: string, rows: unknown[], cardName: string | null, accountName: string, metadata: import('./statement-metadata').StatementMetadata) {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('finalize_statement_import', {
    p_statement_id: statementId, p_rows: rows, p_card_name: cardName,
    p_account_name: accountName, p_metadata: metadata,
  });
  if (error) {
    if (error.code === 'PGRST202') throw new Error('Database update required: run supabase/migrate_v5_reliability.sql in Supabase SQL Editor.');
    throw new Error('Could not finalize the import. No partial import is committed. Please retry.');
  }
  return data as { count: number; reconciliation: { status: string; difference: number | null; possible_overlap_count: number } };
}

export async function getAccounts() {
  const { createClient } = await import('@/utils/supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase.from('accounts').select('id,name,type').order('name');
  if (error) throw new Error('Unable to load accounts. Run migrate_v5_reliability.sql if upgrading.');
  return (data ?? []) as { id: string; name: string; type: 'savings' | 'credit' }[];
}
