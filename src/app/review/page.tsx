import Link from 'next/link';
import { CATEGORIES } from '@/lib/transaction-domain';
import { getTransactions } from '@/lib/supabase';
import { CategoryReview } from '@/components/ReviewForms';
import { formatCurrency } from '@/lib/utils';
export const dynamic = 'force-dynamic';

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; page?: string; statement?: string }> }) {
  const p = await searchParams;
  const rows = (await getTransactions()).filter(t => (!p.category || t.category === p.category) && (!p.q || t.description.toLowerCase().includes(p.q.toLowerCase())) && (!p.statement || t.statement_id === p.statement));
  const page = Math.min(Math.max(1, Number(p.page) || 1),Math.max(1,Math.ceil(rows.length/50)));
  const link = (value: number) => `/review?${new URLSearchParams({category:p.category??'',q:p.q??'',statement:p.statement??'',page:String(value)})}`;
  return <div><div className="page-header"><div><h1>Review transactions</h1><p>Compare classifications with your statement. No automatic relabelling or duplicate removal.</p></div></div>
    <form className="period-filter section" action="/review"><label>Category<select className="input" name="category" defaultValue={p.category??''}><option value="">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>Description<input className="input" name="q" defaultValue={p.q} placeholder="e.g. CRED" /></label>{p.statement && <input type="hidden" name="statement" value={p.statement} />}<button className="btn">Filter</button></form>
    <p>{rows.length} matching transactions. Transfers exclude internal account movements from spending; refunds should represent returned purchases or adjustments. Verify the purpose before changing a category.</p>
    <div className="card table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Original description</th><th>Amount</th><th>Category</th></tr></thead><tbody>{rows.slice((page-1)*50,page*50).map(t=><tr key={t.id}><td>{t.date}</td><td>{t.description}</td><td>{t.type==='credit'?'+':'−'}{formatCurrency(t.amount)}</td><td><CategoryReview transaction={t}/></td></tr>)}</tbody></table></div><nav className="period-filter"><span>Page {page}</span>{page>1&&<Link className="btn" href={link(page-1)}>Previous</Link>}{page*50<rows.length&&<Link className="btn" href={link(page+1)}>Next</Link>}</nav>
  </div>;
}
