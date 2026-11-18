import { database } from "./db";
import { fiscalSchema, profileSchema, unconfiguredFiscal, type BusinessProfile, type FiscalSettings } from "./business-core";

export * from "./business-core";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

async function setting(key: string, db?: Db) {
  const { rows } = await (db ?? await database()).query<{ value: unknown }>("SELECT value FROM catalog_store_settings WHERE key = $1", [key]);
  return rows[0]?.value;
}
export async function getBusinessProfile(db?: Db): Promise<BusinessProfile | null> {
  const parsed = profileSchema.safeParse(await setting("business_profile", db));
  return parsed.success ? parsed.data : null;
}
export async function getFiscalSettings(db?: Db): Promise<FiscalSettings> {
  const parsed = fiscalSchema.safeParse(await setting("fiscal_settings", db));
  return parsed.success ? parsed.data : unconfiguredFiscal;
}

