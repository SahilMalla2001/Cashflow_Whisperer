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
  let query = supabase.from("transactions").select("*").order("date", { ascending: false });

  if (source) query = query.eq("source", source);
  if (range?.startDate) query = query.gte("date", range.startDate);
  if (range?.endDate) query = query.lte("date", range.endDate);

  const { data, error } = await query;
  if (error) {
    console.error("getTransactions error:", error.message, error.code);
    return [];
  }
  return (data ?? []) as Transaction[];
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

export async function getSummary(range?: DateRange): Promise<{
  totalInflow: number;
  totalOutflow: number;
  savings: number;
  savingsRate: number;
  needs: number;
  wants: number;
  savingsCategory: number;
  transfers: number;
  loanPayments: number;
}> {
  const transactions = await getTransactions(undefined, range);
  let totalInflow = 0;
  let totalOutflow = 0;
  let needs = 0;
  let wants = 0;
  let savingsCategory = 0;
  let transfers = 0;
  let loanPayments = 0;

  for (const transaction of transactions) {
    if (transaction.type === "credit" && transaction.category === "Income") {
      totalInflow += transaction.amount;
      continue;
    }
    if (transaction.type === "credit" && transaction.category === "Refund") {
      totalOutflow -= transaction.amount;
      continue;
    }
    if (transaction.type !== "debit") continue;

    if (transaction.category === "Needs") {
      needs += transaction.amount;
      totalOutflow += transaction.amount;
    } else if (transaction.category === "Wants") {
      wants += transaction.amount;
      totalOutflow += transaction.amount;
    } else if (transaction.category === "Loan") {
      loanPayments += transaction.amount;
      totalOutflow += transaction.amount;
    } else if (transaction.category === "Savings") {
      savingsCategory += transaction.amount;
    } else if (transaction.category === "Transfer") {
      transfers += transaction.amount;
    }
  }

  // Transfers are not income or consumption. Savings/investments lower available cash,
  // but stay separate from spending so the dashboard can report both accurately.
  const savings = totalInflow - totalOutflow - savingsCategory;
  const savingsRate = totalInflow > 0 ? (savings / totalInflow) * 100 : 0;
  return { totalInflow, totalOutflow, savings, savingsRate, needs, wants, savingsCategory, transfers, loanPayments };
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
