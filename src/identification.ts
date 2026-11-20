import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { database } from "./db";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

/**
 * Stable, opaque, revocable member identification, used by the card QR and the Apple Wallet barcode.
 * It is NOT the 5-minute single-use redemption code and it carries no personal data. The public value is
 * `serial` (12 random symbols stored in the database) + a 10-symbol MAC derived on the server from the serial and the account's
 * `version` with a server key. Nothing secret is stored: rotating bumps the version (the old value stops resolving at once) and
 * revoking sets `revoked_at`. Only an authenticated staff member can resolve a value to a member.
 */
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols, no 0/O/1/I
export const identifierLength = 22;
export const identifierPattern = /^[A-Z2-9]{22}$/;

function symbols(bytes: Buffer, count: number) {
  let out = "";
  for (let i = 0; i < count; i++) out += alphabet[bytes[i] % 32];
  return out;
}
function serverKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Identification needs BETTER_AUTH_SECRET (32+ characters)");
  return createHmac("sha256", secret).update("salut-identifier-v1").digest();
}
const mac = (serial: string, version: number) => symbols(createHmac("sha256", serverKey()).update(`${serial}.${version}`).digest(), 10);

export function identifierValue(serial: string, version: number) {
  return serial + mac(serial, version);
}
/** The URL encoded in the card QR and in the Wallet barcode. Short on purpose: fewer QR modules means a bigger logo is possible. */
export function identifierUrl(value: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/s/${value}`;
}

export async function ensureIdentifier(accountId: string, db?: Db) {
  const connection = db ?? await database();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows: [row] } = await connection.query<{ serial: string; version: number; revoked_at: Date | null }>(
      `INSERT INTO loyalty_identifiers (account_id, serial) VALUES ($1, $2)
       ON CONFLICT (account_id) DO UPDATE SET account_id = EXCLUDED.account_id
       RETURNING serial, version, revoked_at`, [accountId, symbols(randomBytes(12), 12)]).catch(error => {
      if ((error as { code?: string }).code === "23505") return { rows: [] as never[] }; // serial collision: retry
      throw error;
    });
    if (row) return { serial: row.serial, version: row.version, revoked: Boolean(row.revoked_at), value: identifierValue(row.serial, row.version) };
  }
  throw new Error("Could not create an identifier");
}

/** Resolves a scanned value for staff. Anything malformed, unknown, tampered, rotated or revoked resolves to nothing. */
export async function lookupIdentifier(raw: string, db?: Db) {
  const value = raw.trim().toUpperCase();
  if (!identifierPattern.test(value)) return undefined;
  const serial = value.slice(0, 12);
  const { rows: [row] } = await (db ?? await database()).query<{ account_id: string; version: number; revoked_at: Date | null; member_code: string; balance: number; status: string; name: string | null }>(`
    SELECT i.account_id, i.version, i.revoked_at, a.member_code, a.balance, a.status, u."name"
    FROM loyalty_identifiers i JOIN loyalty_accounts a ON a.id = i.account_id LEFT JOIN "user" u ON u."id" = a.user_id
    WHERE i.serial = $1`, [serial]);
  if (!row || row.revoked_at) return undefined;
  const expected = Buffer.from(identifierValue(serial, row.version)), given = Buffer.from(value);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  return { accountId: row.account_id, memberCode: row.member_code, balance: row.balance, status: row.status,
    firstName: row.name ? row.name.trim().split(/\s+/)[0] : null, guest: row.name === null };
}

/** New value for the same member; the previous QR and Wallet barcode stop resolving immediately. */
export async function rotateIdentifier(accountId: string, actor: string, db?: Db) {
  const connection = db ?? await database();
  await ensureIdentifier(accountId, connection);
  await connection.query(`
    WITH saved AS (UPDATE loyalty_identifiers SET version = version + 1, rotated_at = now(), revoked_at = NULL WHERE account_id = $1 RETURNING account_id, version)
    INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.identifier.rotate', account_id::text, jsonb_build_object('version', version, 'actor', $2::text) FROM saved`, [accountId, actor]);
  await connection.query("UPDATE wallet_passes SET last_updated_at = now() WHERE account_id = $1", [accountId]);
}

export async function revokeIdentifier(accountId: string, actor: string, db?: Db) {
  const connection = db ?? await database();
  await connection.query(`
    WITH saved AS (UPDATE loyalty_identifiers SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL RETURNING account_id),
    voided AS (UPDATE wallet_passes SET voided_at = now(), last_updated_at = now() WHERE account_id = $1 RETURNING account_id)
    INSERT INTO catalog_audit_history (action, subject, details) SELECT 'loyalty.identifier.revoke', account_id::text, jsonb_build_object('actor', $2::text) FROM saved`, [accountId, actor]);
}
