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
- [ ] Recurring transaction & subscription detection
- [ ] Net worth tracker
- [ ] CSV export
- [ ] Multi-user support

---

## 📄 License

MIT
