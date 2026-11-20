import type { NextConfig } from "next";
const config: NextConfig = {
  // Clickjacking protection: pages may only be framed by this site (the demonstration shows customer and team screens side by side).
  async headers() { return [{ source: "/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] }]; },
  // Every image in public/ is already an optimized WebP at its final size (30-80 KB). Serving them directly from
  // the static CDN avoids Vercel's image-optimization quota (HTTP 402 "Payment Required" when a plan limit is hit).
  images: { unoptimized: true },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingIncludes: { "/*": ["./db/*.sql", "./assets/wallet/*.png", "./public/brand/logo.svg"] },
};
export default config;
