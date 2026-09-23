# 💸 Cashflow Whisperer

A personal finance dashboard that imports bank and credit card statements via PDF, categorises every transaction with AI, and gives you an AI-powered financial advisor. Statement content used for extraction is sent to Groq's API.

---

## ✨ Features

- **PDF Statement Import** — Upload savings or credit card statements (text-based or scanned/image-based)
- **AI Extraction** — Groq `qwen/qwen3.8-27b` parses transactions from both text and image PDFs
- **Smart Categorisation** — Every transaction is automatically assigned a category (Needs / Wants / Savings / Income / Loan / Transfer) and subcategory
- **Multi-card Support** — Track multiple credit cards and savings accounts separately
- **50/30/20 Dashboard** — Visual breakdown of spending vs income
- **Spending Charts** — Monthly trends, category breakdowns, and card-level analytics
- **AI Financial Advisor** — Chat with an advisor that has full context of your real transaction data
- **Password-protected PDFs** — Enter the PDF password at upload time

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| AI / LLM | Groq API — `qwen/qwen3.8-27b` |
| PDF text extraction | `pdf-parse` v1 |
| PDF image rendering | `pdfjs-dist` v6 + `@napi-rs/canvas` |
| Charts | Recharts |
| Styling | Vanilla CSS |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A [Groq API key](https://console.groq.com)
- A [Supabase](https://supabase.com) project

### 1. Clone & install

```bash
git clone https://github.com/SahilMalla2001/Cashflow_Whisperer
cd Cashflow_Whisperer
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root:

```env
# Groq
GROQ_API_KEY=gsk_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

### 3. Set up the database

For a new project, run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. For an existing project, run `migrate_v2.sql`, `migrate_v3_ingestion.sql`, and then [`migrate_v4_auth.sql`](./supabase/migrate_v4_auth.sql). After signing in once, follow the backfill instructions in the v4 migration to assign existing records to your account.

```sql
create table transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null,
  description text not null,
  amount numeric(12, 2) not null,
  type text check (type in ('credit', 'debit')),
  category text check (category in ('Needs', 'Wants', 'Savings', 'Income', 'Loan')),
  subcategory text,
  source text not null,
  card_name text
);
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 📤 Uploading Statements

1. Navigate to **Upload** in the sidebar
2. Select **Savings Account** or **Credit Card**
3. Drop your PDF (or click to browse)
4. If the PDF is password-protected, enter the password
5. Click **Upload & Import**

### Supported PDF types

### Dashboard insights

The dashboard compares the selected month with the previous month. With no month selected, insights use the latest imported transaction month; the main totals remain all-time. Current-month comparisons stop at today's day of the month in both periods (India time).

Category and merchant/description tables show purchase totals and changes, with loan payments, investment contributions, and refunds displayed separately. Merchant grouping ignores case and repeated whitespace; it does not infer merchant identities. Date spans describe observed transactions, not verified statement coverage. Missing months do not produce percentage comparisons.

Summary cards, charts, and comparisons share the same accounting calculations. Cash remaining means income minus spending, loan payments, and investment contributions, plus refunds; it is not an account balance or net worth. No additional AI calls or database migration are required for these insights.

### PDF processing

| Type | How it's handled |
|---|---|
| Digital / text-layer PDF | `pdf-parse` extracts text → sent to Groq as text |
| Scanned / image-only PDF | `pdfjs-dist` renders pages to PNG → sent to Groq vision |

> **Note:** Vision requests contain up to three pages each, but the importer processes a scanned statement in sequential batches. Scanned statements are currently limited to 24 pages and uploads to 4.45 MB, leaving room for multipart request overhead on Vercel and Netlify. Files are SHA-256 hashed, so a previously imported statement is rejected before processing.

---

## 🏗 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Dashboard (50/30/20 summary, charts)
│   ├── upload/               # Upload page
│   ├── savings/              # Savings account transaction view
│   ├── credit/               # Credit card transaction view
│   ├── ai/                   # AI Financial Advisor chat
│   └── api/
│       ├── upload/route.ts   # PDF → transactions pipeline
│       └── chat/             # AI advisor API
├── lib/
│   ├── groq.ts               # Groq API (text extraction, vision extraction, chat)
│   ├── pdf-to-images.ts      # PDF → PNG rendering (pdfjs + @napi-rs/canvas)
│   └── supabase.ts           # Supabase client & data helpers
└── components/               # Reusable UI components
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key from [console.groq.com](https://console.groq.com) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase browser-safe publishable key |

---

## 📦 Key Dependencies

```json
{
  "next": "16.3.5",
  "groq-sdk": "^1.6.0",
  "pdf-parse": "^1.1.1",
  "pdfjs-dist": "^6.3.289",
  "@napi-rs/canvas": "^1.0.9",
  "@supabase/supabase-js": "^2.116.0",
  "recharts": "^3.10.1"
}
```

---

## 🗺 Roadmap

- [x] Chunked extraction for text statements and scanned statements up to 24 pages
- [x] Duplicate statement detection with a SHA-256 file hash
- [ ] Rule-based categorisation engine (pre-LLM)
- [ ] Manual category correction
- [x] Recurring monthly payment candidates (confirmation still required)
- [ ] Net worth tracker
- [ ] CSV export
- [x] Supabase authentication and per-user RLS

---

## 📄 License

MIT


## Reliability and insights upgrade

Existing installations: run `supabase/migrate_v5_reliability.sql` in the Supabase SQL Editor **after v4**, before uploading with this version. Fresh installations: run `schema.sql`, then `migrate_v5_reliability.sql`. This is a transactional migration; it preserves existing transactions. It has not been applied automatically to your hosted project.

- Uploads now require a stable account label. Use the same label for future statements and distinct labels for separate accounts. Account labels are case-insensitive. Older imports remain unassigned; no account identity is guessed.
- `finalize_statement_import` inserts rows, assigns an account, stores reconciliation, and marks the statement complete atomically under the caller's RLS session. Repeated finalization is idempotent. Do not restore the former separate insert/update calls.
- Accounts & Statements shows import history and persisted balance checks. Bank checks use opening + credits - debits; credit cards use opening + debits - credits (amounts owed). Missing/conflicting statement balances are unverified. Mismatches are saved with a visible review warning. A match does not prove semantic accuracy, categorization, or complete coverage.
- Dashboard patterns show likely monthly payments, upcoming commitments, unusual purchase amounts, purchase frequency/size, investment contributions and income left after outgoings. Recurring candidates require at least three consistent monthly observations. Unusual purchases require five previous same-description/account purchases and a conservative median/MAD threshold. These are descriptive estimates, not confirmed liabilities or fraud detection.
- Advisor uses bounded read-only tools over the authenticated user's imported records for date ranges, merchants, totals and paginated transaction details. It cannot see unimported history, asset balances or loan terms.
- Text chunks are smaller and scanned pages render one at a time. The default output cap is 900 tokens; text chunks retry in smaller pieces on truncation. Set `GROQ_OUTPUT_TOKEN_BUDGET` (512?8192) only to a value your provider allowance supports. Dense scanned pages may need a higher allowance. Truncated/invalid extraction aborts the import; quota failures remain possible and show a retry message instead of raw provider details.
- File limit remains 4.45 MB and scanned-page limit remains 24. Direct-to-storage uploads and background processing are not part of this upgrade.
- No test cases were added. Validate the migration on your Supabase project, then upload a statement and compare the stored count and reconciliation with the source PDF. `supabase/verify_imports.sql` provides read-only count and ownership checks.

Remaining limitations: same-account exact-description/date/amount overlaps are flagged for review, but rows are preserved because identical purchases can be legitimate; merchant aliases are not automatically merged; mixed scanned/text PDFs need manual completeness checks; recurring estimates are affected by incomplete imports. A process killed before finalization can leave a processing reservation; review its linked rows before clearing it. Account-level balances and transfer matching are not yet implemented. For a personal deployment disable public signup in Supabase Auth settings.
