# 💸 Cashflow Whisperer

A personal finance dashboard that imports bank and credit card statements via PDF, categorises every transaction with AI, and gives you an AI-powered financial advisor — all running on your own infrastructure.

---

## ✨ Features

- **PDF Statement Import** — Upload savings or credit card statements (text-based or scanned/image-based)
- **AI Extraction** — Groq `qwen/qwen3.8-27b` parses transactions from both text and image PDFs
- **Smart Categorisation** — Every transaction is automatically assigned a category (Needs / Wants / Savings / Income / Loan) and subcategory
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
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Set up the database

Run the following SQL in your Supabase SQL editor:

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

> **Note:** For scanned PDFs, only the first 3 pages are sent to the vision model (Groq `qwen/qwen3.8-27b` limit). Statements longer than 3 pages may have incomplete imports.

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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (for server-side inserts) |

---

## 📦 Key Dependencies

```json
{
  "next": "16.3.5",
  "groq-sdk": "^1.6.0",
  "pdf-parse": "^1.1.1",
  "pdfjs-dist": "^6.3.289",
  "@napi-rs/canvas": "^0.1.x",
  "@supabase/supabase-js": "^2.116.0",
  "recharts": "^3.10.1"
}
```

---

## 🗺 Roadmap

- [ ] Chunked extraction for statements > 3 pages
- [ ] Duplicate transaction detection
- [ ] Rule-based categorisation engine (pre-LLM)
- [ ] Manual category correction
- [ ] Recurring transaction & subscription detection
- [ ] Net worth tracker
- [ ] CSV export
- [ ] Multi-user support

---

## 📄 License

MIT
