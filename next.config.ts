import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these packages out of Turbopack's bundle — loaded by Node.js natively.
  // pdf-parse uses eval("require"); canvas and pdfjs-dist use dynamic import/require.
  serverExternalPackages: ["pdf-parse", "canvas", "pdfjs-dist", "@napi-rs/canvas"],

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
