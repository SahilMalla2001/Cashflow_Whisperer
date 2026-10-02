'use client';
import { useState, type FormEvent } from 'react';
import { CATEGORIES } from '@/lib/transaction-domain';
import { useRouter } from 'next/navigation';
import type { Statement, Transaction } from '@/lib/supabase';

function useSaveReview() {
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const router = useRouter();
  async function save(input: object) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/review',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Save failed');
      setMessage(data.message); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed'); }
    finally { setBusy(false); }
  }
  return {save,message,busy};
}
export function BalanceReview({ statement }: { statement: Statement }) {
  const { save,message,busy } = useSaveReview();
  const r = statement.reconciliation;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    void save({action:'balance',id:statement.id,start:form.get('start'),end:form.get('end'),opening:Number(form.get('opening')),closing:Number(form.get('closing'))});
  };
  return <details><summary className="text-link">Review statement balances</summary><form className="review-form" onSubmit={submit}>
    <p>Copy the period and balances printed on this statement. Do not enter an inferred opening balance just to make the figures match. {statement.source === 'credit' && 'For cards, use balances owed; a credit balance is negative.'}</p>
    <label>Period start<input className="input" type="date" name="start" required defaultValue={r?.statement_start ?? ''} /></label>
    <label>Period end<input className="input" type="date" name="end" required defaultValue={r?.statement_end ?? ''} /></label>
    <label>Opening balance (₹)<input className="input" type="number" step=".01" name="opening" required defaultValue={r?.opening_balance ?? ''} /></label>
    <label>Closing balance (₹)<input className="input" type="number" step=".01" name="closing" required defaultValue={r?.closing_balance ?? ''} /></label>
    <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save and reconcile'}</button><p role="status">{message}</p>
  </form></details>;
}
export function CategoryReview({ transaction: t }: { transaction: Transaction }) {
  const {save,message,busy} = useSaveReview();
  return <details><summary className="text-link">{t.category} · Edit</summary><form className="review-form" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void save({action:'category',id:t.id,category:f.get('category'),subcategory:f.get('subcategory')}); }}>
    <label>Category<select name="category" className="input" defaultValue={t.category}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label>
    <label>Subcategory<input className="input" name="subcategory" defaultValue={t.subcategory} maxLength={120} /></label><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save category'}</button><p role="status">{message}</p>
  </form></details>;
}
