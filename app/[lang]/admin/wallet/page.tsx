import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language, pickupDate } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";
import { walletStatus } from "../../../../src/wallet";

export const metadata = { robots: { index: false, follow: false } };

/** Readiness and diagnostics for the card QR and the Apple Wallet pass. Credentials are never shown: only whether each setting exists. */
export default async function AdminWallet({ params }: PageProps<"/[lang]/admin/wallet">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const db = await database();
  const status = await walletStatus(db);
  const { rows: [ids] } = await db.query<{ total: number; rotated: number; revoked: number }>(
    "SELECT count(*)::int AS total, count(rotated_at)::int AS rotated, count(revoked_at)::int AS revoked FROM loyalty_identifiers");
  const { rows: recent } = await db.query<{ member_code: string; issued_at: Date | string; last_updated_at: Date | string; downloads: number; voided_at: Date | null; last_error: string | null }>(
    `SELECT a.member_code, p.issued_at, p.last_updated_at, p.downloads, p.voided_at, p.last_error FROM wallet_passes p JOIN loyalty_accounts a ON a.id = p.account_id ORDER BY p.last_updated_at DESC LIMIT 20`);
  return <section className="wrap catalog-page">
    <h1>Card QR and Apple Wallet</h1>
    <div className="console-stats">
      <div className="panel"><small>Card QR codes</small><strong>{ids.total}</strong><span>{ids.rotated} replaced · {ids.revoked} revoked</span></div>
      <div className="panel"><small>Wallet passes</small><strong>{status.issued}</strong><span>{status.voided} voided · {status.devices} devices</span></div>
      <div className="panel"><small>Pass update errors</small><strong>{status.errors}</strong></div>
    </div>
    <div className="panel" role="status"><h2>Apple Wallet: {status.configured ? "configured" : "not connected"}</h2>
      <p>{status.configured ? "Customers see “Add to Apple Wallet”. The pass is signed on the server. It has not been verified on a real iPhone until someone installs one and scans it."
        : "Customers see a “coming soon” notice instead of the button. Apple Wallet needs an Apple Developer account, a Pass Type ID certificate and the Apple WWDR certificate. Add them as secret environment variables in Vercel; never in the repository or this screen."}</p>
      <ul>{status.settings.map(s => <li key={s.name}><code>{s.name}</code>: {s.present ? "present" : "missing"}</li>)}</ul>
      <p className="fine-print">The barcode on every pass is the member&apos;s stable card QR, never the single-use redemption code. To stop a leaked QR or pass: open the customer in <strong>Customers</strong> and replace or revoke the card QR.</p></div>
    <h2>Recent passes</h2>
    {!recent.length ? <p>No pass has been issued.</p> : <div className="table-scroll"><table className="price-table"><thead><tr><th>Member</th><th>Issued</th><th>Updated</th><th>Downloads</th><th>State</th></tr></thead>
      <tbody>{recent.map(row => <tr key={row.member_code}><td>{row.member_code}</td><td>{pickupDate(new Date(row.issued_at).toISOString(), "en")}</td><td>{pickupDate(new Date(row.last_updated_at).toISOString(), "en")}</td><td>{row.downloads}</td><td>{row.voided_at ? "voided" : "active"}{row.last_error && ` · ${row.last_error}`}</td></tr>)}</tbody></table></div>}
  </section>;
}
