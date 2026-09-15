const Groq = require('groq-sdk').default;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const res = await groq.chat.completions.create({
    model: 'qwen/qwen3.8-27b',
    messages: [
      { role: 'system', content: 'Return ONLY a valid JSON object. No markdown, no explanations.' },
      { role: 'user', content: 'Give me a JSON with key hello and value world.' }
    ],
    temperature: 0.1,
    max_completion_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const msg = res.choices[0]?.message;
  console.log('CONTENT:', JSON.stringify(msg?.content ?? null));
  console.log('REASONING_CONTENT:', JSON.stringify(msg?.reasoning_content ?? null));
  console.log('ALL KEYS:', Object.keys(msg ?? {}).join(', '));
}

main().catch(console.error);
