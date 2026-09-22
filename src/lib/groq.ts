import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const STATEMENT_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  json_schema: {
    name: "statement_transactions",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["card_name", "transactions"],
      properties: {
        card_name: { type: ["string", "null"] },
        transactions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["date", "description", "amount", "type", "category", "subcategory"],
            properties: {
              date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
              description: { type: "string" },
              amount: { type: "number", exclusiveMinimum: 0 },
              type: { type: "string", enum: ["credit", "debit"] },
              category: {
                type: "string",
                enum: ["Needs", "Wants", "Savings", "Income", "Loan", "Transfer", "Refund"],
              },
              subcategory: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: "Needs" | "Wants" | "Savings" | "Income" | "Loan" | "Transfer" | "Refund";
  subcategory: string;
}

export interface ParseResult {
  card_name: string | null; // detected credit card name, null for savings
  transactions: ParsedTransaction[];
}

// ---- Statement extraction prompt ----
const EXTRACT_PROMPT = `You are a financial data extraction AI. Given raw text from a bank or credit card statement, extract ALL transactions and the card/account name.

Return ONLY a valid JSON object with this exact shape:
{
  "card_name": "<detected card name, e.g. 'HDFC Swiggy Credit Card' or 'SBI Savings Account'. Use null for generic savings/bank accounts>",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "cleaned merchant or description",
      "amount": 1234.56,
      "type": "credit or debit",
      "category": "Needs | Wants | Savings | Income | Loan | Transfer | Refund",
      "subcategory": "specific sub-category"
    }
  ]
}

Category rules:
- Income: salary credits, reimbursements
- Loan: EMI payments, loan repayments  
- Needs: rent, utilities, groceries, medicine, transport (essentials)
- Wants: food delivery, restaurants, entertainment, shopping, subscriptions
- Savings: mutual funds, SIPs, FDs, investments, savings transfers
- Transfer: money moved between the user's own accounts, credit-card bill payments, and other internal settlements. Do not classify these as spending or income.
- Refund: merchant refunds, reversals, and card adjustments. Use a credit transaction for these.

For card_name:
- Extract the full card/account name from the statement header (e.g. "HDFC Swiggy Credit Card", "Axis Bank Ace Credit Card", "ICICI Savings Account")
- If the source is a savings/bank account, set card_name to null
- Be specific — include the bank name and card variant

Return ONLY the JSON object, no markdown or explanations.`;

export async function parseStatementWithGroq(
  rawText: string,
  source: "savings" | "credit"
): Promise<ParseResult> {
  const sourceLabel = source === "credit" ? "credit card" : "bank/savings account";

  const completion = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      {
        role: "user",
        content: `Parse this ${sourceLabel} statement and extract the card name and all transactions:\n\n${rawText}`,
      },
    ],
    temperature: 0.1,
    max_completion_tokens: 4096,
    response_format: STATEMENT_RESPONSE_FORMAT,
  });

  const text = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      card_name: source === "credit" ? (parsed.card_name ?? "Unknown Credit Card") : null,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    console.error("[groq/text] JSON parse failed:", text.slice(0, 500));
    return { card_name: null, transactions: [] };
  }
}

// ---- Vision-based statement extraction (for image/scanned PDFs) ----
export async function parseStatementFromImages(
  pageImages: string[], // base64 PNG strings, one per page (max 5)
  source: "savings" | "credit"
): Promise<ParseResult> {
  const sourceLabel = source === "credit" ? "credit card" : "bank/savings account";

  // Build the content array: text prompt + one image_url block per page
  const imageBlocks = pageImages.map((b64) => ({
    type: "image_url" as const,
    image_url: { url: `data:image/png;base64,${b64}` },
  }));

  const completion = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Parse this ${sourceLabel} statement from the page images below and extract the card name and ALL transactions. Return ONLY the JSON object.`,
          },
          ...imageBlocks,
        ],
      },
    ],
    temperature: 0.1,
    max_completion_tokens: 4096,
    response_format: STATEMENT_RESPONSE_FORMAT,
  });

  const text = completion.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      card_name: source === "credit" ? (parsed.card_name ?? "Unknown Credit Card") : null,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    console.error("[groq/vision] JSON parse failed:", text.slice(0, 500));
    return { card_name: null, transactions: [] };
  }
}

// ---- AI Chat advisor ----
export async function chatWithAdvisor(
  messages: { role: "user" | "assistant"; content: string }[],
  context: string
): Promise<string> {
  const systemPrompt = `You are a sharp, concise personal financial advisor with access to the user's real transaction data. 
Be direct, practical, and data-driven. Use Indian Rupee (₹) currency.
Give specific, actionable advice based on actual numbers. Reference specific transactions when relevant.
Use concise Markdown with short headings and lists when it improves readability.

User's financial context:
${context}`;

  const conversation = [...messages];
  const parts: string[] = [];

  // A detailed financial plan can exceed one completion. Continue once when the
  // provider explicitly reports a length stop, rather than showing a cut-off sentence.
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversation,
      ],
      temperature: 0.7,
      max_tokens: 2048,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content?.trim();
    if (!content) break;
    parts.push(content);

    if (choice.finish_reason !== "length") break;
    conversation.push(
      { role: "assistant", content },
      { role: "user", content: "Continue from the exact point where you stopped. Do not repeat anything." }
    );
  }

  return parts.join("\n\n") || "I couldn't generate a response.";
}
