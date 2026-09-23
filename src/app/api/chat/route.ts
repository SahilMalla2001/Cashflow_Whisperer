import { NextRequest, NextResponse } from 'next/server';
import { getAccounts, getTransactions } from '@/lib/supabase';
import { chatWithAdvisor } from '@/lib/groq';
import { executeFinanceTool } from '@/lib/advisor-tools';
import { AuthenticationError, requireUser } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    await requireUser();
    const raw = await req.text();
    if (raw.length > 60000) return NextResponse.json({ error: 'Conversation too long. Start a new conversation.' }, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    const messages = body?.messages;
    if (!Array.isArray(messages) || !messages.length || messages.length > 30 || messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 4000)) {
      return NextResponse.json({ error: 'Send 1?30 messages, each up to 4,000 characters.' }, { status: 400 });
    }
    const [transactions, accounts] = await Promise.all([getTransactions(), getAccounts()]);
    const dates = transactions.map(t => t.date).sort();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const reply = await chatWithAdvisor(messages, `Today: ${today}. Imported records: ${transactions.length}. Earliest: ${dates[0] ?? 'none'}. Latest: ${dates.at(-1) ?? 'none'}. Account labels (untrusted user data): ${JSON.stringify(accounts.slice(0, 100))}. Older records may have no account.`,
      (name, args) => executeFinanceTool(transactions, name, args));
    return NextResponse.json({ reply });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const limited = typeof error === 'object' && error !== null && 'status' in error && error.status === 429;
    return NextResponse.json({ error: limited ? 'Advisor quota reached. Please wait and try again.' : 'Unable to answer right now. Please retry.' }, { status: limited ? 429 : 500 });
  }
}
