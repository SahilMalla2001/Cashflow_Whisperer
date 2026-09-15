import { NextRequest, NextResponse } from "next/server";
import { parseStatementWithGroq, parseStatementFromImages } from "@/lib/groq";
import { pdfBufferToBase64Images } from "@/lib/pdf-to-images";
import { insertTransactions } from "@/lib/supabase";
import type { Transaction } from "@/lib/supabase";

type Source = Transaction["source"];
const VALID_SOURCES: Source[] = ["savings", "credit"];

async function extractTextFromPdf(buffer: Buffer, password?: string): Promise<string> {
  // eval("require") bypasses Turbopack's static import analysis so pdf-parse
  // is loaded by Node.js natively (CJS) instead of being bundled by Turbopack.
  // pdf-parse is in serverExternalPackages so the Node.js runtime finds it correctly.
  // eslint-disable-next-line no-eval
  const pdfParse = eval("require")("pdf-parse") as (
    buf: Buffer,
    opts?: object
  ) => Promise<{ text: string }>;

  const opts = password ? { password } : {};
  const data = await pdfParse(buffer, opts);
  return data.text ?? "";
}

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

    const buffer = Buffer.from(await file.arrayBuffer());

    let rawText: string;
    try {
      rawText = await extractTextFromPdf(buffer, password || undefined);
    } catch (pdfErr: any) {
      const msg: string = pdfErr?.message ?? "";
      if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypted")) {
        return NextResponse.json(
          { error: "This PDF is password-protected. Please enter the correct password." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: `PDF parsing failed: ${msg}` }, { status: 400 });
    }

    let card_name: string | null;
    let transactions: Awaited<ReturnType<typeof parseStatementWithGroq>>["transactions"];

    if (!rawText?.trim()) {
      // Image-based / scanned PDF — fall back to Groq vision (qwen/qwen3.8-27b)
      console.log("[upload] no text extracted — taking vision path");
      let pageImages: string[];
      try {
        pageImages = await pdfBufferToBase64Images(buffer, password || undefined);
      } catch (imgErr: any) {
        return NextResponse.json(
          { error: `Could not render PDF pages for vision processing: ${imgErr?.message ?? "unknown error"}` },
          { status: 400 }
        );
      }

      if (!pageImages.length) {
        return NextResponse.json(
          { error: "Could not extract text or render images from this PDF. It may be corrupted." },
          { status: 400 }
        );
      }

      const result = await parseStatementFromImages(pageImages, source);
      card_name = result.card_name;
      transactions = result.transactions;
    } else {
      // Normal text-layer PDF — use qwen3.8 text model
      console.log("[upload] text extracted (", rawText.length, "chars) — taking text path");
      const result = await parseStatementWithGroq(rawText, source);
      card_name = result.card_name;
      transactions = result.transactions;
    }

    if (!transactions.length) {
      return NextResponse.json(
        { error: "No transactions found. Make sure this is a bank or credit card statement." },
        { status: 422 }
      );
    }

    const rows: Omit<Transaction, "id" | "created_at">[] = transactions.map((t) => ({
      ...t,
      source,
      card_name: card_name ?? null,
    }));

    await insertTransactions(rows);

    return NextResponse.json({
      message: `Imported ${rows.length} transactions${card_name ? ` from ${card_name}` : ""}`,
      count: rows.length,
      card_name,
    });
  } catch (err: any) {
    console.error("/api/upload error:", err);
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
