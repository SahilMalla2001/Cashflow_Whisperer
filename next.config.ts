import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF.js and its native renderer run only in Node.js route handlers.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  // PDF.js loads this worker by a runtime string, outside static import tracing.
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
