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
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("source", "credit")
    .eq("card_name", cardName)
    .order("date", { ascending: false });
  if (error) {
    console.error("getTransactionsByCard error:", error.message);
    return [];
  }
  return (data ?? []) as Transaction[];
}

export async function getDistinctCards(): Promise<string[]> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("card_name")
    .eq("source", "credit")
    .not("card_name", "is", null);
  if (error) {
    console.error("getDistinctCards error:", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((row: { card_name: string | null }) => row.card_name))]
    .filter((name): name is string => Boolean(name));
}

export async function getSummary(range?: DateRange) {
  const { summarize } = await import("./insights");
  return summarize(await getTransactions(undefined, range));
}

export async function insertTransactions(txns: Omit<Transaction, "id" | "created_at">[]) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(txns);
  if (error) throw new Error(error.message);
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

export async function completeStatement(statementId: string, cardName: string | null, transactionCount: number) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("statements")
    .update({
      status: "complete",
      card_name: cardName,
      transaction_count: transactionCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", statementId);
  if (error) throw new Error(error.message);
}

export async function discardStatement(statementId: string) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("statements").delete().eq("id", statementId);
  if (error) console.error("discardStatement error:", error.message);
}
