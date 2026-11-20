import { notFound } from "next/navigation";
import Link from "next/link";
import { database } from "../../../../src/db";
import { language, pickupDate } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";

export const metadata = { robots: { index: false, follow: false } };
const pageSize = 40;

/** Who changed what: every admin change (prices, hours, tax, rewards rules, team, refunds, demo settings) with the acting account. */
export default async function AdminActivity({ params, searchParams }: PageProps<"/[lang]/admin/activity">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const query = await searchParams;
  const area = typeof query.area === "string" && /^[a-z]{2,20}$/.test(query.area) ? query.area : "";
  const page = Math.max(1, Math.min(10000, Number(typeof query.page === "string" ? query.page : 1) || 1));
  const db = await database();
  const [{ rows }, { rows: areas }] = await Promise.all([
    db.query<{ id: string; action: string; subject: string; details: Record<string, unknown>; occurred_at: Date | string }>(
      `SELECT id::text, action, subject, details, occurred_at FROM catalog_audit_history WHERE ($1 = '' OR action LIKE $1 || '.%' OR action = $1) ORDER BY id DESC LIMIT ${pageSize + 1} OFFSET $2`, [area, (page - 1) * pageSize]),
    db.query<{ area: string }>("SELECT DISTINCT split_part(action, '.', 1) AS area FROM catalog_audit_history ORDER BY 1"),
  ]);
  const more = rows.length > pageSize;
  const link = (p: number) => `/${lang}/admin/activity?${new URLSearchParams({ ...(area ? { area } : {}), page: String(p) })}`;
  const summary = (details: Record<string, unknown>) => {
    const { actor, ...rest } = details;
    const text = JSON.stringify(rest);
    return { actor: typeof actor === "string" ? actor : "", text: text.length > 160 ? `${text.slice(0, 157)}…` : text };
  };
  return <section className="wrap catalog-page">
    <h1>Change history</h1>
    <p>Every change made in the admin is recorded here and cannot be edited or deleted.</p>
    <form className="catalog-filters"><label>Area<select name="area" defaultValue={area}><option value="">All</option>{areas.map(row => <option key={row.area} value={row.area}>{row.area}</option>)}</select></label><button className="outline">Filter</button></form>
    {!rows.length ? <p>No changes recorded.</p> : <div className="table-scroll"><table className="price-table">
      <thead><tr><th>When</th><th>Action</th><th>Subject</th><th>By</th><th>Details</th></tr></thead>
      <tbody>{rows.slice(0, pageSize).map(row => { const s = summary(row.details); return <tr key={row.id}><td>{pickupDate(new Date(row.occurred_at).toISOString(), "en")}</td><td>{row.action}</td><td>{row.subject}</td><td>{s.actor}</td><td><small>{s.text}</small></td></tr>; })}</tbody></table></div>}
    <p>{page > 1 && <Link href={link(page - 1)}>← Newer</Link>}{page > 1 && more && " · "}{more && <Link href={link(page + 1)}>Older →</Link>}</p>
  </section>;
}
