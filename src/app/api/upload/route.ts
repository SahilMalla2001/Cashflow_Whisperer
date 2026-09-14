import { NextRequest, NextResponse } from "next/server";
import { parseStatementWithGroq } from "@/lib/groq";
import { insertTransactions } from "@/lib/supabase";
import type { Transaction } from "@/lib/supabase";

type Source = Transaction["source"];

const VALID_SOURCES: Source[] = ["savings", "credit_swiggy", "credit_roarbank"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawSource = formData.get("source") as string | null;
    const password = formData.get("password") as string | null;

    if (!file || !rawSource) {
      return NextResponse.json({ error: "Missing file or source" }, { status: 400 });
    }

    const source = rawSource as Source;
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid source value" }, { status: 400 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // pdf-parse ESM import
    const pdfModule = await import("pdf-parse");
    // Handle both CJS default and ESM named exports
    const pdfParse: (buf: Buffer, opts?: any) => Promise<{ text: string }> =
      (pdfModule as any).default ?? (pdfModule as any);

    let pdfData: { text: string };
    try {
      pdfData = await pdfParse(buffer, password ? { password } : undefined);
    } catch (pdfErr: any) {
      if (pdfErr.message?.includes("password")) {
        return NextResponse.json(
          { error: "This PDF is password-protected. Please enter the correct password." },
          { status: 400 }
        );
      }
      throw pdfErr;
    }

    const rawText = pdfData.text;
    if (!rawText?.trim()) {
      return NextResponse.json({ error: "Could not extract text from PDF" }, { status: 400 });
    }

    // Parse with Groq LLM
    const parsed = await parseStatementWithGroq(rawText, source);
    if (!parsed.length) {
      return NextResponse.json({ error: "No transactions found in the PDF" }, { status: 422 });
    }

    // Attach source (typed correctly)
    const rows: Omit<Transaction, "id" | "created_at">[] = parsed.map((t) => ({
      ...t,
      source,
    }));

    await insertTransactions(rows);

    return NextResponse.json({
      message: "Transactions imported successfully",
      count: rows.length,
    });
  } catch (err: any) {
    console.error("/api/upload error:", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
