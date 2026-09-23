/** Shared loader for text extraction and scanned-page rendering. */
export async function loadPdfDocument(buffer: Buffer, password?: string) {
  const canvas = await import('@napi-rs/canvas');
  Object.assign(globalThis, { DOMMatrix: canvas.DOMMatrix });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';
  return pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password,
    useSystemFonts: true,
  });
}

export async function extractTextFromPdf(buffer: Buffer, password?: string): Promise<string> {
  const task = await loadPdfDocument(buffer, password);
  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      try {
        const content = await page.getTextContent();
        let text = '';
        let previousY: number | undefined;
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = item.transform[5];
          if (text && !text.endsWith('\n')) {
            text += previousY !== undefined && Math.abs(y - previousY) > 2 ? '\n' : ' ';
          }
          text += item.str;
          if (item.hasEOL) text += '\n';
          previousY = y;
        }
        pages.push(text);
      } finally {
        page.cleanup();
      }
    }
    return pages.join('\n\n');
  } finally {
    await task.destroy();
  }
}

export function pdfPasswordError(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('name' in error) || error.name !== 'PasswordException') return null;
  return 'code' in error && error.code === 1
    ? 'This PDF requires a password. Enter the PDF opening password and retry.'
    : 'The PDF could not be opened with that password. Check capitalization and retry.';
}
