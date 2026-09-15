import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  category: "Needs" | "Wants" | "Savings" | "Income" | "Loan";
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
      "category": "Needs | Wants | Savings | Income | Loan",
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
        content: `Parse this ${sourceLabel} statement and extract the card name and all transactions:\n\n${rawText.slice(0, 100000)}`,
      },
    ],
    temperature: 0.1,
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  console.log("[groq/text] raw response (first 500):", text.slice(0, 500));

  try {
    const parsed = JSON.parse(text);
    console.log("[groq/text] transactions found:", parsed.transactions?.length ?? 0);
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
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content ?? "{}";
  console.log("[groq/vision] raw response (first 500):", text.slice(0, 500));

  try {
    const parsed = JSON.parse(text);
    console.log("[groq/vision] transactions found:", parsed.transactions?.length ?? 0);
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

User's financial context:
${context}`;

  const completion = await groq.chat.completions.create({
    model: "qwen/qwen3.8-27b",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return completion.choices[0]?.message?.content ?? "I couldn't generate a response.";
}
