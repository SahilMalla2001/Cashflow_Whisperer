/**
 * Server-only PDF text extractor.
 * This file is intentionally plain JS with no TypeScript generics,
 * so Turbopack treats it as a simple Node.js module.
 *
 * Listed in next.config.ts > serverExternalPackages so Node.js
 * loads it via require() directly — not bundled by Turbopack.
 */

// @ts-ignore
const pdfParse = require("pdf-parse");

/**
 * @param {Buffer} buffer
 * @param {string | undefined} password
 * @returns {Promise<string>}
 */
async function extractPdfText(buffer, password) {
  const opts = password ? { password } : {};
  const data = await pdfParse(buffer, opts);
  return data.text ?? "";
}

module.exports = { extractPdfText };
