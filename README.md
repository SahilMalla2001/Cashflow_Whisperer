# Cashflow Whisperer

Personal finance dashboard for imported bank and credit-card statements. Built with Next.js, Supabase Auth/Postgres, and Groq.

## Local setup

Use Node.js 22.13 or newer in the 22.x release line (PDF.js requires this minimum).

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and fill in the three required keys.
3. For a fresh database, run `supabase/schema.sql`, then `supabase/migrate_v5_reliability.sql` in Supabase SQL Editor. Existing installations should apply only missing migrations in order; v5 requires v4. Preserve the migration history.
4. Configure Supabase Auth URL settings with local site URL `http://localhost:3000` and callback `http://localhost:3000/auth/callback`.
5. Run `npm run dev` and sign in.

For personal use, create your own Supabase Auth user and disable public signups in Supabase. Financial records are isolated by user ownership and row-level security. Do not restore permissive `allow_all` policies. Review ownerless legacy records before any reassignment.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe publishable key; RLS must remain enabled |
| `GROQ_API_KEY` | Server-only Groq key |
| `GROQ_TEXT_OUTPUT_TOKEN_BUDGET` | Optional; default 3072 |
| `GROQ_ADVISOR_OUTPUT_TOKEN_BUDGET` | Optional; default 2048 |
| `GROQ_VISION_OUTPUT_TOKEN_BUDGET` | Optional; default 900 |

Token overrides accept integers 512?8192. Completion budgets include reasoning and do not increase provider allowances. The legacy `GROQ_OUTPUT_TOKEN_BUDGET` is a fallback for vision only. Never put the Groq key in a `NEXT_PUBLIC_` variable or commit real credentials.

## Imports and AI

- PDF.js extracts text and opens password-protected PDFs. GPT-OSS-120B on Groq extracts transactions from bounded text chunks.
- Image-only statements render one page at a time using PDF.js and `@napi-rs/canvas`, then use Qwen 3.8 27B. Scans are limited to 24 pages.
- Uploads are limited to 4.45 MB. Enter a stable account label, choose bank/card, supply the PDF password if needed, and select Upload.
- SHA-256 prevents importing the exact same file twice for one user. Possible overlaps across different statements are flagged, not automatically deleted.
- JSON schema extraction is followed by runtime validation. The database RPC `finalize_statement_import` saves transactions and completes the statement atomically.
- The advisor uses GPT-OSS-120B and bounded read-only tools over the authenticated user's imported records.

Statement content required for extraction and advisor context is sent to Groq. PDFs are processed in memory; this app does not retain the original PDF in object storage. Supabase stores extracted transactions and statement metadata.

## Understanding the figures

The dashboard defaults to the latest imported month. Its period selector controls the totals; All imported history disables monthly comparisons. Current-month figures stop at today in India.

- Recorded income: credits classified as Income.
- Spending and loans: Needs + Wants + Loan debits, minus Refund credits.
- Imported surplus: recorded income minus spending/loans and investment contributions. This is not a bank balance or net worth.
- Transfers are excluded from spending. Bank activity separately displays money movement; card headlines identify gross debits, not outstanding bills.
- Bank balances are dated statement snapshots. Accounts & Statements allows review of printed balances and dates. Bank reconciliation checks opening + credits - debits; card reconciliation checks opening + debits - credits.
- Review transactions allows category/subcategory corrections without changing amounts or original descriptions.
- Comparisons require assigned accounts and contiguous, reconciled statement coverage for both periods. Recurring payments and unusual amounts are estimates from imported history.

Read-only SQL helpers: `verify_imports.sql` checks stored counts/ownership; `audit_dashboard.sql` reproduces totals; `review_unassigned.sql` inspects ownerless legacy records. SQL Editor can see other users' records: do not publish its results.

## Deployment

Vercel is the recommended first target for this synchronous import pipeline.

1. Import the repository with the Next.js preset and Node.js 22.x. Install: `npm ci`; build: `npm run build`. Let the preset determine the output directory.
2. Set the required environment variables in the hosting dashboard for the intended environment. Local `.env.local` is not uploaded.
3. Enable/check Fluid Compute. Upload and chat routes declare `maxDuration = 300`; your plan's actual limit still applies. See [Vercel function limits](https://vercel.com/docs/functions/limitations).
4. In Supabase Auth, set the production Site URL and allow the deployed `https://your-domain/auth/callback`. Add only trusted preview callbacks when needed.
5. After deployment, verify sign-in/out, text and password-protected imports, a scanned page, card details, and advisor responses. Compare imported rows and balances against the source statement.

Netlify is possible, but its [synchronous function limit](https://docs.netlify.com/build/functions/configuration/) is 60 seconds. Groq waits and multi-page imports can exceed that; use a background processing design before relying on lengthy imports there. A larger AI-provider document limit does not remove the hosting request-body limit.

The native renderer must be included in the Linux deployment bundle. Local Windows builds do not prove hosted PDF rendering works. Root-level PDF samples/screenshots and local environment files are excluded from Git/Vercel uploads; public branding remains included.

## Checks and remaining limits

Run `npm run lint` and `npm run build` before deployment. No automated test cases are included.

- Free-tier Groq rate limits still apply. The SDK retries once using retry headers; exhausted retries fail without a partial transaction import.
- Imports have no durable resume queue. A platform timeout can leave a processing reservation; inspect its linked rows before clearing it.
- Mixed text/scanned PDFs require manual completeness review. A balance match does not prove all rows or classifications are correct.
- Overlapping imports, missing statements, refund classification and unpaired transfers can affect analytics.
- No direct-to-storage uploads, live bank connections, or loan/investment balances are implemented.

## Source layout

- `src/app`: pages, authenticated API routes and auth callback.
- `src/components`: shared UI, charts and review forms.
- `src/lib`: extraction, validation, accounting, insights and database helpers.
- `src/utils/supabase`: browser/server session clients.
- `supabase`: schema, ordered migrations and read-only audits.
