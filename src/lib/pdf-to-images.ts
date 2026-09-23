/** Render one page at a time and release resources on errors. */
import { loadPdfDocument } from './pdf-document';

export async function* renderPdfBatches(buffer: Buffer, password?: string): AsyncGenerator<string[]> {
  const canvasLib = await import('@napi-rs/canvas');
  const task = await loadPdfDocument(buffer, password);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 24) throw new Error('Scanned statements are limited to 24 pages. Split this PDF before uploading.');
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      if (viewport.width * viewport.height > 12_000_000) throw new Error('PDF page dimensions are too large.');
      const canvas = canvasLib.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      try {
        await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport, background: 'white' }).promise;
        yield [(await canvas.encode('png')).toString('base64')];
      } finally {
        page.cleanup();
        canvas.width = canvas.height = 1;
      }
    }
  } finally {
    await task.destroy();
  }
}
