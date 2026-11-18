export function usesOfficialCatalog() {
  return Boolean(process.env.DATABASE_URL);
}
