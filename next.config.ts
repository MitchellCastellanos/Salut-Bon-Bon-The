import type { NextConfig } from "next";
const config: NextConfig = {
  // Every image in public/ is already an optimized WebP at its final size (30-80 KB). Serving them directly from
  // the static CDN avoids Vercel's image-optimization quota (HTTP 402 "Payment Required" when a plan limit is hit).
  images: { unoptimized: true },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: { "/*": ["./db/*.sql"] },
};
export default config;
