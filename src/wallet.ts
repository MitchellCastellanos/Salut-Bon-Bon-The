import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { connect } from "node:http2";
import { crc32 } from "node:zlib";
import { join } from "node:path";
import forge from "node-forge";
import { database } from "./db";
import { ensureIdentifier, identifierUrl } from "./identification";
import { stampsForReward } from "./rewards-math";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };

/**
 * Apple Wallet loyalty pass (`.pkpass`): a ZIP with pass.json, images, a SHA-1 manifest and a detached PKCS#7 signature made with the
 * Pass Type ID certificate. Credentials come only from server environment variables (base64 PEM) and never touch the database, logs or
 * the repository. Nothing is offered to customers until every variable is present. The barcode carries the stable identification URL,
 * never the short-lived redemption code. NOT YET VERIFIED ON A REAL IPHONE (needs Apple credentials).
 *
 * APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_PEM_B64 (Pass Type ID certificate), APPLE_PASS_KEY_PEM_B64 (its private key),
 * APPLE_PASS_KEY_PASSPHRASE (optional), APPLE_WWDR_PEM_B64 (Apple WWDR intermediate certificate), SITE_URL (https).
 */
type Config = { passTypeId: string; teamId: string; cert: string; key: string; passphrase?: string; wwdr: string; site: string };

export function walletConfig(env: Record<string, string | undefined> = process.env): Config | undefined {
  const b64 = (value?: string) => value ? Buffer.from(value, "base64").toString("utf8") : "";
  const config = { passTypeId: env.APPLE_PASS_TYPE_ID ?? "", teamId: env.APPLE_TEAM_ID ?? "", cert: b64(env.APPLE_PASS_CERT_PEM_B64),
    key: b64(env.APPLE_PASS_KEY_PEM_B64), passphrase: env.APPLE_PASS_KEY_PASSPHRASE || undefined, wwdr: b64(env.APPLE_WWDR_PEM_B64), site: env.SITE_URL ?? "" };
  const ok = /^pass\.[\w.-]+$/.test(config.passTypeId) && /^[A-Z0-9]{10}$/.test(config.teamId) && config.cert.includes("BEGIN CERTIFICATE")
    && config.key.includes("PRIVATE KEY") && config.wwdr.includes("BEGIN CERTIFICATE") && /^https:\/\//.test(config.site)
    && Boolean(env.DATABASE_URL) && (env.BETTER_AUTH_SECRET ?? "").length >= 32;
  return ok ? config : undefined;
}
export const walletConfigured = () => Boolean(walletConfig());

const serverKey = () => createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update("salut-wallet-v1").digest();
/** Deterministic per-pass token for Apple's web service (Authorization: ApplePass <token>); only a hash is ever stored. */
export const passAuthToken = (serial: string) => createHmac("sha256", serverKey()).update(`auth:${serial}`).digest("hex");
export function validAuthToken(serial: string, header: string | null) {
  const given = Buffer.from(header?.startsWith("ApplePass ") ? header.slice(10).trim() : "");
  const expected = Buffer.from(passAuthToken(serial));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const assetDir = join(process.cwd(), "assets", "wallet");
const asset = (name: string) => readFileSync(join(assetDir, name));

/** Minimal ZIP (stored, no compression), enough for a .pkpass. */
export function zip(files: { name: string; data: Buffer }[]) {
  const locals: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name), crc = crc32(file.data) >>> 0;
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18); local.writeUInt32LE(file.data.length, 22); local.writeUInt16LE(name.length, 26);
    locals.push(local, name, file.data);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50, 0); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(file.data.length, 20); entry.writeUInt32LE(file.data.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + file.data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

function sign(manifest: Buffer, config: Pick<Config, "cert" | "key" | "passphrase" | "wwdr">) {
  const cert = forge.pki.certificateFromPem(config.cert), wwdr = forge.pki.certificateFromPem(config.wwdr);
  const key = config.passphrase ? forge.pki.decryptRsaPrivateKey(config.key, config.passphrase) : forge.pki.privateKeyFromPem(config.key);
  if (!key) throw new Error("Pass signing key could not be read");
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(cert); p7.addCertificate(wwdr);
  p7.addSigner({ key, certificate: cert, digestAlgorithm: forge.pki.oids.sha1, authenticatedAttributes: [
    { type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest },
    { type: forge.pki.oids.signingTime, value: new Date() as unknown as string }] });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

export type PassInput = { serial: string; balance: number; memberCode: string; barcodeUrl: string; name: string | null; lang: "fr" | "en"; voided?: boolean; updatedAt: Date };

export function passJson(input: PassInput, config: Pick<Config, "passTypeId" | "teamId" | "site">) {
  const fr = input.lang === "fr";
  const ready = input.balance >= stampsForReward;
  const toGo = ready ? 0 : stampsForReward - input.balance;
  const progress = ready ? stampsForReward : input.balance;
  return {
    formatVersion: 1, passTypeIdentifier: config.passTypeId, teamIdentifier: config.teamId, serialNumber: input.serial,
    organizationName: "Salut Bon Bon Thé", description: fr ? "Carte Récompenses Salut" : "Salut Rewards card",
    logoText: "Salut Bon Bon Thé", foregroundColor: "rgb(74, 44, 26)", labelColor: "rgb(161, 57, 39)", backgroundColor: "rgb(255, 248, 239)",
    webServiceURL: `${config.site.replace(/\/$/, "")}/api/wallet`, authenticationToken: passAuthToken(input.serial),
    ...(input.voided ? { voided: true } : {}),
    barcodes: [{ format: "PKBarcodeFormatQR", message: input.barcodeUrl, messageEncoding: "iso-8859-1", altText: input.memberCode }],
    storeCard: {
      primaryFields: [{ key: "stamps", label: fr ? "TAMPONS" : "STAMPS", value: `${progress} / ${stampsForReward}`, changeMessage: fr ? "Tampons : %@" : "Stamps: %@" }],
      secondaryFields: [{ key: "next", label: fr ? "PROCHAINE BOISSON GRATUITE" : "NEXT FREE DRINK", value: ready ? (fr ? "Prête !" : "Ready!") : (fr ? `Dans ${toGo} boisson${toGo > 1 ? "s" : ""}` : `In ${toGo} drink${toGo > 1 ? "s" : ""}`) }],
      auxiliaryFields: [{ key: "member", label: fr ? "MEMBRE" : "MEMBER", value: input.name?.split(/\s+/)[0] ?? input.memberCode }],
      backFields: [{ key: "terms", label: fr ? "Comment ça marche" : "How it works",
        value: fr ? "9 boissons achetées, la 10e est gratuite. Présentez ce code au comptoir. Ce code ne contient aucun renseignement personnel." : "Buy 9 drinks, the 10th is free. Show this code at the counter. It holds no personal information." },
        { key: "code", label: fr ? "Numéro de membre" : "Member number", value: input.memberCode }],
    },
  };
}

export function buildPass(input: PassInput, config: Config) {
  const files: { name: string; data: Buffer }[] = [{ name: "pass.json", data: Buffer.from(JSON.stringify(passJson(input, config))) }];
  for (const name of ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"]) files.push({ name, data: asset(name) });
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(files.map(file => [file.name, createHash("sha1").update(file.data).digest("hex")]))));
  return zip([...files, { name: "manifest.json", data: manifest }, { name: "signature", data: sign(manifest, config) }]);
}

type Account = { id: string; member_code: string; balance: number; name: string | null };
async function accountRow(accountId: string, db: Db) {
  return (await db.query<Account>(`SELECT a.id, a.member_code, a.balance, u."name" FROM loyalty_accounts a LEFT JOIN "user" u ON u."id" = a.user_id WHERE a.id = $1`, [accountId])).rows[0];
}

/** Creates (or returns) the pass record for an account and builds the current signed pass. */
export async function issuePass(accountId: string, lang: "fr" | "en", db?: Db) {
  const config = walletConfig();
  if (!config) throw new Error("WALLET_NOT_CONFIGURED");
  const connection = db ?? await database();
  const account = await accountRow(accountId, connection);
  if (!account) throw new Error("ACCOUNT_NOT_FOUND");
  const id = await ensureIdentifier(accountId, connection);
  if (id.revoked) throw new Error("REVOKED");
  const serial = randomBytes(16).toString("hex");
  const { rows: [pass] } = await connection.query<{ serial: string; last_updated_at: Date; voided_at: Date | null }>(`
    INSERT INTO wallet_passes (account_id, serial, auth_token_hash, lang) VALUES ($1, $2, $3, $4)
    ON CONFLICT (account_id) DO UPDATE SET downloads = wallet_passes.downloads + 1, voided_at = NULL, lang = EXCLUDED.lang
    RETURNING serial, last_updated_at, voided_at`, [accountId, serial, createHash("sha256").update(passAuthToken(serial)).digest("hex"), lang]);
  return buildPass({ serial: pass.serial, balance: account.balance, memberCode: account.member_code, name: account.name, lang,
    barcodeUrl: identifierUrl(id.value, config.site), updatedAt: new Date(pass.last_updated_at) }, config);
}

/** Current pass for Apple's update fetch (serial known, auth verified by the caller). */
export async function currentPass(serial: string, db?: Db) {
  const config = walletConfig();
  if (!config || !/^[0-9a-f]{32}$/.test(serial)) return undefined;
  const connection = db ?? await database();
  const { rows: [pass] } = await connection.query<{ account_id: string; last_updated_at: Date; voided_at: Date | null; lang: "fr" | "en" }>("SELECT account_id, last_updated_at, voided_at, lang FROM wallet_passes WHERE serial = $1", [serial]);
  if (!pass) return undefined;
  const account = await accountRow(pass.account_id, connection);
  const id = await ensureIdentifier(pass.account_id, connection);
  return { updatedAt: new Date(pass.last_updated_at), data: buildPass({ serial, balance: account.balance, memberCode: account.member_code, name: account.name, lang: pass.lang,
    barcodeUrl: identifierUrl(id.value, config.site), voided: Boolean(pass.voided_at) || id.revoked, updatedAt: new Date(pass.last_updated_at) }, config) };
}

/** After a balance change: mark the pass updated and ask registered devices to refresh. Best effort, never throws. */
export async function notifyPassChange(accountId: string, db?: Db) {
  try {
    const connection = db ?? await database();
    const { rows } = await connection.query<{ push_token: string; serial: string }>(
      `WITH touched AS (UPDATE wallet_passes SET last_updated_at = now() WHERE account_id = $1 RETURNING serial)
       SELECT r.push_token, r.serial FROM wallet_registrations r JOIN touched t ON t.serial = r.serial`, [accountId]);
    const config = walletConfig();
    if (config && rows.length) await Promise.all(rows.map(row => pushPassUpdate(row.push_token, config).catch(error => connection.query(
      "UPDATE wallet_passes SET last_error = $2 WHERE serial = $1", [row.serial, (error instanceof Error ? error.message : "push failed").slice(0, 200)]))));
  } catch (error) {
    console.error("wallet pass update failed", { message: error instanceof Error ? error.message : "unknown" });
  }
}

/** APNs "pass updated" push: empty payload, topic = pass type id, authenticated with the pass certificate. */
function pushPassUpdate(pushToken: string, config: Config) {
  return new Promise<void>((resolve, reject) => {
    if (!/^[0-9a-fA-F]{16,256}$/.test(pushToken)) return reject(new Error("Invalid push token"));
    const session = connect("https://api.push.apple.com", { cert: config.cert, key: config.key, passphrase: config.passphrase });
    session.on("error", reject);
    const request = session.request({ ":method": "POST", ":path": `/3/device/${pushToken}`, "apns-topic": config.passTypeId });
    let status = 0;
    request.on("response", headers => { status = Number(headers[":status"]); });
    request.on("end", () => { session.close(); if (status === 200) resolve(); else reject(new Error(`APNs HTTP ${status}`)); });
    request.on("error", reject);
    request.end("{}");
  });
}

/** Which wallet settings are present (names only, never values) and pass counters, for the admin status screen. */
export async function walletStatus(db?: Db) {
  const names = ["APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID", "APPLE_PASS_CERT_PEM_B64", "APPLE_PASS_KEY_PEM_B64", "APPLE_WWDR_PEM_B64", "SITE_URL", "BETTER_AUTH_SECRET"];
  const settings = names.map(name => ({ name, present: Boolean(process.env[name]) }));
  const connection = db ?? await database();
  const { rows: [counts] } = await connection.query<{ issued: number; voided: number; devices: number; errors: number }>(`
    SELECT (SELECT count(*) FROM wallet_passes)::int AS issued, (SELECT count(*) FROM wallet_passes WHERE voided_at IS NOT NULL)::int AS voided,
           (SELECT count(*) FROM wallet_registrations)::int AS devices, (SELECT count(*) FROM wallet_passes WHERE last_error IS NOT NULL)::int AS errors`);
  return { configured: walletConfigured(), settings, ...counts };
}
