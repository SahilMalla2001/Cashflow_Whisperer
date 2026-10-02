import { isIsoDate, CATEGORIES } from '@/lib/transaction-domain';
import { NextRequest, NextResponse } from 'next/server';
import { AuthenticationError, requireUser, createClient } from '@/utils/supabase/server';
import { getTransactions } from '@/lib/supabase';

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const raw = await request.text();
    if (raw.length > 4000) return NextResponse.json({ error: 'Request too large' }, { status: 413 });
    let input;
    try { input = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
    if (!input || typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id)) return NextResponse.json({ error: 'Invalid record' }, { status: 400 });
    const client = await createClient();
    if (input.action === 'category') {
      if (!CATEGORIES.includes(input.category) || typeof input.subcategory !== 'string' || input.subcategory.length > 120) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      const { data: row, error: readError } = await client.from('transactions').select('type').eq('id',input.id).eq('user_id',user.id).single();
      if (readError || !row) return NextResponse.json({ error: 'Transaction unavailable' }, { status: 404 });
      if ((['Income','Refund'].includes(input.category) && row.type !== 'credit') || (['Needs','Wants','Loan'].includes(input.category) && row.type !== 'debit')) return NextResponse.json({ error: 'This category does not match the transaction direction.' }, { status: 400 });
      const { data, error } = await client.from('transactions').update({ category: input.category, subcategory: input.subcategory.trim() }).eq('id',input.id).eq('user_id',user.id).select('id');
      if (error || !data?.length) throw new Error('Could not save category');
      return NextResponse.json({ message: 'Category saved. Amount and description unchanged.' });
    }
    if (input.action !== 'balance') return NextResponse.json({ error: 'Unknown review action' }, { status: 400 });
    if (!isIsoDate(input.start) || !isIsoDate(input.end) || input.start > input.end || ![input.opening,input.closing].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e10)) return NextResponse.json({ error: 'Enter valid dates and balances from the statement.' }, { status: 400 });
    const { data: statement, error } = await client.from('statements').select('*').eq('id',input.id).eq('user_id',user.id).single();
    if (error || !statement || statement.status !== 'complete') return NextResponse.json({ error: 'Completed statement unavailable' }, { status: 404 });
    const rows = (await getTransactions()).filter(t => t.statement_id === input.id);
    if (!rows.length || rows.some(t => t.date < input.start || t.date > input.end)) return NextResponse.json({ error: 'The dates must include all imported transactions for this statement. Check its printed period.' }, { status: 400 });
    const net = rows.reduce((sum,t) => sum + (t.type === 'credit' ? 1 : -1) * Math.round(t.amount * 100),0);
    const difference = (Math.round(input.opening*100) + (statement.source === 'credit' ? -net : net) - Math.round(input.closing*100))/100;
    const reconciliation = { ...statement.reconciliation, opening_balance: Math.round(input.opening*100)/100, closing_balance: Math.round(input.closing*100)/100,
      statement_start: input.start, statement_end: input.end, difference,
      status: Math.abs(difference) <= .01 ? 'matched' : 'mismatch', origin: 'user_review', reviewed_at: new Date().toISOString() };
    const { data: saved, error: updateError } = await client.from('statements').update({ reconciliation }).eq('id',input.id).eq('user_id',user.id).select('id');
    if (updateError || !saved?.length) throw new Error('Could not save balance review');
    return NextResponse.json({ message: reconciliation.status === 'matched' ? 'Balances reconcile with the imported rows.' : `Review needed: calculated closing balance differs by ₹${difference.toFixed(2)}.` });
  } catch (error) {
    if (error instanceof AuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: 'Review could not be saved. Please retry.' }, { status: 500 });
  }
}
