// Re-export the SSR server client factory for convenience
export { createClient } from "@/utils/supabase/server";

// ---- Types ----
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: "Needs" | "Wants" | "Savings" | "Income" | "Loan";
  subcategory: string;
  source: "savings" | "credit";
  card_name: string | null; // e.g. "HDFC Swiggy CC" — only set for credit sources
  created_at: string;
}

// ---- Query Helpers ----
export async function getTransactions(source?: string): Promise<Transaction[]> {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();

  let q = supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (source) q = q.eq("source", source);

  const { data, error } = await q;
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

  const names = [...new Set((data ?? []).map((r: any) => r.card_name as string))];
  return names.filter(Boolean);
}

export async function getSummary(): Promise<{
  totalInflow: number;
  totalOutflow: number;
  savings: number;
  savingsRate: number;
  needs: number;
  wants: number;
  savingsCategory: number;
}> {
  const txns = await getTransactions();

  let totalInflow = 0;
  let totalOutflow = 0;
  let needs = 0;
  let wants = 0;
  let savingsCategory = 0;

  for (const t of txns) {
    if (t.type === "credit" && t.category === "Income") {
      totalInflow += t.amount;
    } else if (t.type === "debit") {
      totalOutflow += t.amount;
      if (t.category === "Needs") needs += t.amount;
      else if (t.category === "Wants") wants += t.amount;
      else if (t.category === "Savings") savingsCategory += t.amount;
    }
  }

  const savings = totalInflow - totalOutflow;
  const savingsRate = totalInflow > 0 ? (savings / totalInflow) * 100 : 0;

  return { totalInflow, totalOutflow, savings, savingsRate, needs, wants, savingsCategory };
}

export async function insertTransactions(
  txns: Omit<Transaction, "id" | "created_at">[]
) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(txns);
  if (error) throw new Error(error.message);
}
