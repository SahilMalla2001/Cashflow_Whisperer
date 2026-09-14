import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url === "your_supabase_project_url") {
    throw new Error(
      "Supabase environment variables are not configured. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  _client = createClient(url, key);
  return _client;
}

// Named export for direct use (lazy)
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => {
    const client = getClient();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

// ---- Types ----
export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: "Needs" | "Wants" | "Savings" | "Income" | "Loan";
  subcategory: string;
  source: "savings" | "credit_swiggy" | "credit_roarbank";
  created_at: string;
}

// ---- Queries ----
export async function getTransactions(source?: string): Promise<Transaction[]> {
  let q = supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (source) q = q.eq("source", source);

  const { data, error } = await q;
  if (error) {
    console.error("getTransactions error:", error);
    return [];
  }
  return data as Transaction[];
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

export async function insertTransactions(txns: Omit<Transaction, "id" | "created_at">[]) {
  const { error } = await supabase.from("transactions").insert(txns);
  if (error) throw new Error(error.message);
}
