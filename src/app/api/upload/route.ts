import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { parseStatementFromImages, parseStatementWithGroq } from "@/lib/groq";
import type { ParsedTransaction } from "@/lib/groq";
import { mergeMetadata, type StatementMetadata } from "@/lib/statement-metadata";
import { renderPdfBatches } from "@/lib/pdf-to-images";
import { extractTextFromPdf, pdfPasswordError } from "@/lib/pdf-document";
import {
  finalizeStatement,
  discardStatement,
  reserveStatement,
} from "@/lib/supabase";
import type { Transaction } from "@/lib/supabase";
import { validateTransactions } from "@/lib/transaction-validation";
import { AuthenticationError, requireUser } from "@/utils/supabase/server";

export const runtime = "nodejs";

type Source = Transaction["source"];
const VALID_SOURCES: Source[] = ["savings", "credit"];
// Leave room for multipart form-data overhead beneath Vercel's 4.5 MB request limit.
const MAX_FILE_BYTES = 4_450_000;
const TEXT_CHUNK_SIZE = 2_500;

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

function pickCardName(names: Array<string | null>, source: Source): string | null {
  if (source === "savings") return null;
  return names.find((name) => name && name !== "Unknown Credit Card") ?? "Unknown Credit Card";
}

export async function POST(req: NextRequest) {
  let reservedStatementId: string | null = null;
  let transactionsInserted = false;

  try {
    const user = await requireUser();
    const contentLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + 16_384) {
      return NextResponse.json({ error: "PDF files must be 4.45 MB or smaller." }, { status: 413 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");
    const rawSource = formData.get("source");
    const password = formData.get("password");
    const accountName = formData.get("account_name");
    if (typeof accountName !== 'string' || !accountName.trim() || accountName.trim().length > 120) {
      return NextResponse.json({ error: 'Enter an account label (up to 120 characters). Use the same label for future statements of this account.' }, { status: 400 });
    }

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
      user_id: user.id,
      file_hash: fileHash,
      filename: fileEntry.name,
      file_size: fileEntry.size,
      source,
    });
    if (reservation.duplicate) {
      return NextResponse.json(
        { error: reservation.statement.status === 'complete' ? 'This statement was already imported.' : 'This statement has an unfinished import. Check Accounts & Statements before retrying; a processing reservation may need review.', statement_id: reservation.statement.id },
        { status: 409 }
      );
    }
    reservedStatementId = reservation.statement.id;

    let rawText: string;
    try {
      rawText = await extractTextFromPdf(buffer, typeof password === "string" ? password || undefined : undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown PDF parsing error";
      const passwordError = pdfPasswordError(error);
      if (passwordError) {
        return NextResponse.json(
          { error: passwordError },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: `PDF parsing failed: ${message}` }, { status: 400 });
    }

    const cardNames: Array<string | null> = [];
    const metadata: StatementMetadata[] = [];
    const extractedTransactions: ParsedTransaction[] = [];
    if (rawText.trim()) {
      for (const chunk of splitTextIntoChunks(rawText)) {
        const result = await parseStatementWithGroq(chunk, source);
        cardNames.push(result.card_name);
        metadata.push(result.metadata);
        extractedTransactions.push(...result.transactions);
      }
    } else {
      for await (const images of renderPdfBatches(
        buffer,
        typeof password === "string" ? password || undefined : undefined
      )) {
        const result = await parseStatementFromImages(images, source);
        cardNames.push(result.card_name);
        metadata.push(result.metadata);
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

    const rows = validation.rows.map((row) => ({
      ...row,
      statement_id: reservedStatementId,
      user_id: user.id,
    }));
    if (!rows.length) {
      return NextResponse.json({ error: "No transactions found in this statement." }, { status: 422 });
    }

    const finalized = await finalizeStatement(reservedStatementId, rows, cardName, accountName.trim(), mergeMetadata(metadata));
    transactionsInserted = true;

    return NextResponse.json({
      message: `Imported ${rows.length} transactions${cardName ? ` from ${cardName}` : ""}`,
      count: rows.length,
      card_name: cardName,
      statement_id: reservedStatementId,
      reconciliation: finalized.reconciliation,
    });
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const passwordError = pdfPasswordError(error);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });
    const message = error instanceof Error ? error.message : "Internal server error";
    const rateLimited = typeof error === 'object' && error !== null && 'status' in error && error.status === 429;
    return NextResponse.json({ error: rateLimited ? 'Groq quota reached. Nothing was imported. Wait for your quota to reset, then retry. Dense scanned pages may require a higher output-token allowance.' : message }, { status: rateLimited ? 429 : 500 });
  } finally {
    if (reservedStatementId && !transactionsInserted) {
      await discardStatement(reservedStatementId);
    }
  }
}
