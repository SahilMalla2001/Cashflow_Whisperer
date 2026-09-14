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

const SYSTEM_PROMPT = `You are a financial data extraction AI. Given raw text from a bank or credit card statement, extract ALL transactions and return ONLY a valid JSON array.

Each transaction must have these exact fields:
- date: ISO 8601 date string (YYYY-MM-DD)
- description: cleaned merchant/description string
- amount: positive number (no currency symbol)
- type: "credit" (money in) or "debit" (money out)
- category: one of "Needs", "Wants", "Savings", "Income", "Loan"
- subcategory: specific sub-category (e.g., "Groceries", "Food Delivery", "Salary", "EMI", "Investment", "Utility", "Subscription", "Transfer")

Category rules:
- Income: salary credits, reimbursements
- Loan: EMI payments, loan repayments
- Needs: rent, utilities, groceries, medicine, transport (essentials)
- Wants: food delivery, restaurants, entertainment, shopping, subscriptions, AI tools
- Savings: mutual funds, SIPs, FDs, investments, savings transfers

Return ONLY the JSON array, no explanations or markdown.`;

export async function parseStatementWithGroq(
  rawText: string,
  source: string
): Promise<ParsedTransaction[]> {
  const completion = await groq.chat.completions.create({
    model: "llama3-70b-8192",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Parse this ${source} statement:\n\n${rawText.slice(0, 12000)}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const text = completion.choices[0]?.message?.content ?? "[]";

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    return JSON.parse(match[0]) as ParsedTransaction[];
  } catch {
    console.error("Failed to parse Groq response as JSON");
    return [];
  }
}

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
    model: "llama3-70b-8192",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return completion.choices[0]?.message?.content ?? "I couldn't generate a response.";
}
