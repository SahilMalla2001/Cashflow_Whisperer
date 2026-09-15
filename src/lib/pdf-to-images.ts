/**
 * Server-only utility: renders PDF pages to base64 PNG strings.
 *
 * pdfjs-dist v6 ships a NodeCanvasFactory that uses @napi-rs/canvas.
 * We now use that directly — no custom CanvasFactory needed.
 *
 * Max 3 pages returned — Groq qwen/qwen3.8-27b allows up to 3 images per request.
 */

const MAX_PAGES = 3;
const RENDER_SCALE = 1.5; // ~108 DPI — good quality vs token cost balance

export async function pdfBufferToBase64Images(
  buffer: Buffer,
  password?: string
): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Suppress GlobalWorkerOptions warning — Node.js uses a fake in-thread worker
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "pdfjs-dist/legacy/build/pdf.worker.mjs";

  // Load the @napi-rs/canvas package (what pdfjs's NodeCanvasFactory uses internally)
  // eslint-disable-next-line no-eval
  const napiCanvas = eval("require")("@napi-rs/canvas") as {
    createCanvas: (w: number, h: number) => any;
    DOMMatrix?: unknown;
  };

  // pdfjs uses DOMMatrix during rendering — polyfill it from @napi-rs/canvas if available,
  // otherwise fall back to a minimal compatible implementation.
  if (napiCanvas.DOMMatrix) {
    (globalThis as any).DOMMatrix = napiCanvas.DOMMatrix;
  } else if (!(globalThis as any).DOMMatrix) {
    // Minimal DOMMatrix shim — just enough for pdfjs's transform operations
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;
      constructor(init?: number[] | string) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = init[0]; this.m12 = init[1]; this.m21 = init[2];
          this.m22 = init[3]; this.m41 = init[4]; this.m42 = init[5];
        }
      }
      static fromMatrix(m: any) { return new (globalThis as any).DOMMatrix(); }
      static fromFloat32Array(a: Float32Array) { return new (globalThis as any).DOMMatrix(Array.from(a)); }
      static fromFloat64Array(a: Float64Array) { return new (globalThis as any).DOMMatrix(Array.from(a)); }
      multiply(other: any) { return new (globalThis as any).DOMMatrix(); }
      translate(x = 0, y = 0, z = 0) { return new (globalThis as any).DOMMatrix(); }
      scale(sx = 1, sy?: number, sz?: number, ox?: number, oy?: number, oz?: number) { return new (globalThis as any).DOMMatrix(); }
      rotate(rx = 0, ry?: number, rz?: number) { return new (globalThis as any).DOMMatrix(); }
      inverse() { return new (globalThis as any).DOMMatrix(); }
      toFloat32Array() { return new Float32Array([this.a, this.b, this.c, this.d, this.e, this.f]); }
      toFloat64Array() { return new Float64Array([this.a, this.b, this.c, this.d, this.e, this.f]); }
      toString() { return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`; }
    };
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    password: password ?? "",
    useSystemFonts: true,
    // No custom CanvasFactory — let pdfjs use its own NodeCanvasFactory
    // which is wired to @napi-rs/canvas (now installed at top level)
  });

  const pdfDoc = await loadingTask.promise;
  const pagesToRender = Math.min(pdfDoc.numPages, MAX_PAGES);
  console.log(`[pdf-to-images] PDF has ${pdfDoc.numPages} pages, rendering first ${pagesToRender}`);
  const base64Images: string[] = [];

  for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    // Use @napi-rs/canvas directly (same package pdfjs uses internally)
    const canvas = napiCanvas.createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const context = canvas.getContext("2d");

    // Fill white background (canvas default is transparent)
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    const buffer = await canvas.encode("png");
    const b64 = buffer.toString("base64");
    base64Images.push(b64);

    // DEBUG: save to disk to verify rendering
    const fs = await import("fs");
    const os = await import("os");
    const debugPath = `${os.tmpdir()}/debug_page${pageNum}.png`;
    fs.writeFileSync(debugPath, buffer);
    console.log(`[pdf-to-images] page ${pageNum}: ${Math.ceil(viewport.width)}x${Math.ceil(viewport.height)}px, png size=${buffer.length} bytes, saved to ${debugPath}`);

    page.cleanup();
  }

  await pdfDoc.cleanup();

  return base64Images;
}
