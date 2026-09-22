import { NextRequest, NextResponse } from "next/server";
import { getTransactions, getSummary } from "@/lib/supabase";
import { chatWithAdvisor } from "@/lib/groq";
import { formatCurrency } from "@/lib/utils";
import { AuthenticationError, requireUser } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  try {
    await requireUser();
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
Income across imported statements: ${formatCurrency(totalInflow)}
Consumption spending across imported statements: ${formatCurrency(totalOutflow)}
Net Savings: ${formatCurrency(savings)}
Savings Rate: ${savingsRate.toFixed(1)}%
Needs Spend: ${formatCurrency(needs)}
Wants Spend: ${formatCurrency(wants)}

Recent transactions (most recent 20):
${txnSummary || "No transactions yet."}
    `.trim();

    const safeMessages = Array.isArray(messages)
      ? messages.filter(
          (message): message is { role: "user" | "assistant"; content: string } =>
            (message?.role === "user" || message?.role === "assistant") &&
            typeof message.content === "string"
        )
      : [];
    const reply = await chatWithAdvisor(
      safeMessages,
      context
    );

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("/api/chat error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
