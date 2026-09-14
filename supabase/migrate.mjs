// One-shot schema migration via Supabase REST API
// Run: node supabase/migrate.mjs

const SUPABASE_URL = "https://nlderkixbszxwlrsmalz.supabase.co";
const SERVICE_KEY = "sb_publishable___EVaNRpMBzIUPCyEQnOjg_wNlW9MiE";

const sql = `
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  description text not null,
  amount      numeric(12, 2) not null,
  type        text not null check (type in ('credit', 'debit')),
  category    text not null check (category in ('Needs', 'Wants', 'Savings', 'Income', 'Loan')),
  subcategory text not null default '',
  source      text not null check (source in ('savings', 'credit_swiggy', 'credit_roarbank')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_transactions_source on public.transactions(source);
create index if not exists idx_transactions_date   on public.transactions(date desc);
create index if not exists idx_transactions_type   on public.transactions(type);

alter table public.transactions enable row level security;
`;

// Try creating the policy — it's idempotent so OK if it already exists
const policySQL = `
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'transactions' and policyname = 'allow_all'
  ) then
    execute 'create policy "allow_all" on public.transactions for all using (true) with check (true)';
  end if;
end $$;
`;

async function runSQL(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  return { status: res.status, body: await res.text() };
}

// Use the SQL endpoint directly
async function execSQL(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`, text.slice(0, 300));
  return res.status;
}

// The Supabase REST API doesn't support raw SQL — we need the SQL endpoint
// Let's use pg directly via the connection string
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Test connection first
const { data, error } = await supabase.from("transactions").select("count").limit(1);
if (error && error.code === "42P01") {
  console.log("Table doesn't exist yet — needs to be created via Supabase SQL Editor.");
  console.log("\n📋 Please run this SQL in your Supabase SQL Editor:");
  console.log("   https://supabase.com/dashboard/project/nlderkixbszxwlrsmalz/sql\n");
  console.log(sql);
  console.log(policySQL);
} else if (error) {
  console.log("Connection error:", error.message);
  console.log("\n📋 Please run this SQL in your Supabase SQL Editor:");
  console.log("   https://supabase.com/dashboard/project/nlderkixbszxwlrsmalz/sql\n");
  console.log(sql);
  console.log(policySQL);
} else {
  console.log("✅ Table already exists! Connection is working.");
  console.log("Row count:", data);
}
