import { NextRequest, NextResponse } from "next/server";
import { getTransactions, getSummary } from "@/lib/supabase";
import { chatWithAdvisor } from "@/lib/groq";
import { formatCurrency } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Build context from real data
    const [summary, txns] = await Promise.all([getSummary(), getTransactions()]);
    const { totalInflow, totalOutflow, savings, savingsRate, needs, wants } = summary;

    // Top 20 recent transactions as context
    const txnSummary = txns
      .slice(0, 20)
      .map(
        (t) =>
          `${t.date} | ${t.type === "credit" ? "+" : "-"}${formatCurrency(t.amount)} | ${t.description} | ${t.category} / ${t.subcategory}`
      )
      .join("\n");

    const context = `
Monthly Income: ${formatCurrency(totalInflow)}
Total Spent: ${formatCurrency(totalOutflow)}
Net Savings: ${formatCurrency(savings)}
Savings Rate: ${savingsRate.toFixed(1)}%
Needs Spend: ${formatCurrency(needs)}
Wants Spend: ${formatCurrency(wants)}

Recent transactions (most recent 20):
${txnSummary || "No transactions yet."}
    `.trim();

    const reply = await chatWithAdvisor(
      messages.filter((m: any) => m.role === "user" || m.role === "assistant"),
      context
    );

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("/api/chat error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
