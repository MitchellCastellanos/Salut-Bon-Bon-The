/**
 * The official Neon-backed catalog is used whenever a database is configured, and always in deployed
 * environments (production and preview), which must never fall back to the fictional demo menu.
 */
export function usesOfficialCatalog() {
  const deployed = process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  return Boolean(process.env.DATABASE_URL) || (deployed && process.env.SALUT_ALLOW_DEMO !== "1");
}
