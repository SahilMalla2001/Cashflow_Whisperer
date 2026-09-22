import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseStatementFromImages, parseStatementWithGroq } from "@/lib/groq";
import type { ParsedTransaction } from "@/lib/groq";
import { pdfBufferToBase64Images } from "@/lib/pdf-to-images";
import {
  completeStatement,
  discardStatement,
  insertTransactions,
  reserveStatement,
} from "@/lib/supabase";
import type { Transaction } from "@/lib/supabase";
import { deduplicateTransactions, validateTransactions } from "@/lib/transaction-validation";

export const runtime = "nodejs";

type Source = Transaction["source"];
const VALID_SOURCES: Source[] = ["savings", "credit"];
// Leave room for multipart form-data overhead beneath Vercel's 4.5 MB request limit.
const MAX_FILE_BYTES = 4_450_000;
const TEXT_CHUNK_SIZE = 20_000;
const VISION_BATCH_SIZE = 3;

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function splitTextIntoChunks(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (current && current.length + line.length + 1 > TEXT_CHUNK_SIZE) {
      chunks.push(current);
      current = "";
    }
    if (line.length > TEXT_CHUNK_SIZE) {
      if (current) chunks.push(current);
      for (let offset = 0; offset < line.length; offset += TEXT_CHUNK_SIZE) {
        chunks.push(line.slice(offset, offset + TEXT_CHUNK_SIZE));
      }
    } else {
      current += `${current ? "\n" : ""}${line}`;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((chunk) => chunk.trim());
}

async function extractTextFromPdf(buffer: Buffer, password?: string): Promise<string> {
  // pdf-parse v1 is CommonJS. Loading it at runtime keeps Turbopack from bundling it.
  const pdfParse = eval("require")("pdf-parse") as (
    buf: Buffer,
    opts?: object
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer, password ? { password } : {});
  return data.text ?? "";
}

function pickCardName(names: Array<string | null>, source: Source): string | null {
  if (source === "savings") return null;
  return names.find((name) => name && name !== "Unknown Credit Card") ?? "Unknown Credit Card";
}

export async function POST(req: NextRequest) {
  let reservedStatementId: string | null = null;
  let transactionsInserted = false;

  try {
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 16_384) {
      return NextResponse.json({ error: "PDF files must be 4.45 MB or smaller." }, { status: 413 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");
    const rawSource = formData.get("source");
    const password = formData.get("password");

    if (!(fileEntry instanceof File) || typeof rawSource !== "string") {
      return NextResponse.json({ error: "Missing file or source" }, { status: 400 });
    }
    if (!VALID_SOURCES.includes(rawSource as Source)) {
      return NextResponse.json({ error: "Invalid source value" }, { status: 400 });
    }
    if (!fileEntry.name.toLowerCase().endsWith(".pdf") || !["", "application/pdf"].includes(fileEntry.type)) {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }
    if (fileEntry.size === 0 || fileEntry.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "PDF files must be between 1 byte and 4.45 MB." }, { status: 413 });
    }

    const source = rawSource as Source;
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    if (!isPdf(buffer)) {
      return NextResponse.json({ error: "The uploaded file is not a valid PDF." }, { status: 400 });
    }

    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const reservation = await reserveStatement({
      file_hash: fileHash,
      filename: fileEntry.name,
      file_size: fileEntry.size,
      source,
    });
    if (reservation.duplicate) {
      return NextResponse.json(
        { error: "This statement was already imported.", statement_id: reservation.statement.id },
        { status: 409 }
      );
    }
    reservedStatementId = reservation.statement.id;

    let rawText: string;
    try {
      rawText = await extractTextFromPdf(buffer, typeof password === "string" ? password || undefined : undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown PDF parsing error";
      if (/password|encrypted/i.test(message)) {
        return NextResponse.json(
          { error: "This PDF is password-protected. Please enter the correct password." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: `PDF parsing failed: ${message}` }, { status: 400 });
    }

    const cardNames: Array<string | null> = [];
    const extractedTransactions: ParsedTransaction[] = [];
    if (rawText.trim()) {
      for (const chunk of splitTextIntoChunks(rawText)) {
        const result = await parseStatementWithGroq(chunk, source);
        cardNames.push(result.card_name);
        extractedTransactions.push(...result.transactions);
      }
    } else {
      const images = await pdfBufferToBase64Images(
        buffer,
        typeof password === "string" ? password || undefined : undefined
      );
      for (let offset = 0; offset < images.length; offset += VISION_BATCH_SIZE) {
        const result = await parseStatementFromImages(images.slice(offset, offset + VISION_BATCH_SIZE), source);
        cardNames.push(result.card_name);
        extractedTransactions.push(...result.transactions);
      }
    }

    if (!extractedTransactions.length) {
      return NextResponse.json(
        { error: "No transactions found. Make sure this is a bank or credit card statement." },
        { status: 422 }
      );
    }

    const cardName = pickCardName(cardNames, source);
    const validation = validateTransactions(extractedTransactions, source, cardName);
    if (validation.errors.length) {
      return NextResponse.json(
        { error: "The statement extraction returned invalid transaction data. Nothing was imported.", details: validation.errors.slice(0, 10) },
        { status: 422 }
      );
    }

    const rows = deduplicateTransactions(validation.rows).map((row) => ({
      ...row,
      statement_id: reservedStatementId,
    }));
    if (!rows.length) {
      return NextResponse.json({ error: "No unique transactions found in this statement." }, { status: 422 });
    }

    await insertTransactions(rows);
    transactionsInserted = true;
    await completeStatement(reservedStatementId, cardName, rows.length);

    return NextResponse.json({
      message: `Imported ${rows.length} transactions${cardName ? ` from ${cardName}` : ""}`,
      count: rows.length,
      card_name: cardName,
      statement_id: reservedStatementId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("/api/upload error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (reservedStatementId && !transactionsInserted) {
      await discardStatement(reservedStatementId);
    }
  }
}
