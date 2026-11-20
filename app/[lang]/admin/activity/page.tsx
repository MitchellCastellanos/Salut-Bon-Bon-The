import Link from "next/link";
import { database } from "../../../../src/db";
import { pickupDate } from "../../../../src/domain";
import { auditLabel } from "../../../../src/labels";
import { adminPage } from "../guard";
import { PageHeader } from "../ui";

export const metadata = { robots: { index: false, follow: false } };
const pageSize = 40;

/** Who changed what: every admin change (menu, prices, hours, tax, rewards rules, team, refunds) with the acting account. */
export default async function AdminActivity({ params, searchParams }: PageProps<"/[lang]/admin/activity">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const area = typeof query.area === "string" && /^[a-z]{2,20}$/.test(query.area) ? query.area : "";
  const subject = typeof query.subject === "string" && /^[A-Za-z0-9:_.-]{1,80}$/.test(query.subject) ? query.subject : "";
  const page = Math.max(1, Math.min(10000, Number(typeof query.page === "string" ? query.page : 1) || 1));
  const db = await database();
  const [{ rows }, { rows: areas }] = await Promise.all([
    db.query<{ id: string; action: string; subject: string; details: Record<string, unknown>; occurred_at: Date | string }>(
      `SELECT id::text, action, subject, details, occurred_at FROM catalog_audit_history WHERE ($1 = '' OR action LIKE $1 || '.%' OR action = $1) AND ($2 = '' OR subject = $2 OR subject LIKE $2 || ':%')
       ORDER BY id DESC LIMIT ${pageSize + 1} OFFSET $3`, [area, subject, (page - 1) * pageSize]),
    db.query<{ area: string }>("SELECT DISTINCT split_part(action, '.', 1) AS area FROM catalog_audit_history ORDER BY 1"),
  ]);
  const more = rows.length > pageSize;
  const link = (p: number) => `/${lang}/admin/activity?${new URLSearchParams({ ...(area ? { area } : {}), ...(subject ? { subject } : {}), page: String(p) })}`;
  const summary = (details: Record<string, unknown>) => {
    const { actor, ...rest } = details;
    const text = JSON.stringify(rest);
    return { actor: typeof actor === "string" ? actor : "", text: text.length > 160 ? `${text.slice(0, 157)}…` : text };
  };
  return <section className="wrap">
    <PageHeader title="Change history" intro="Every change made in the administration is recorded here with who made it. Entries cannot be edited or deleted."/>
    <form className="catalog-filters"><label>Type of change<select name="area" defaultValue={area}><option value="">All</option>{areas.map(row => <option key={row.area} value={row.area}>{row.area}</option>)}</select></label>
      {subject && <input type="hidden" name="subject" value={subject}/>}<button className="outline">Filter</button>{subject && <Link href={`/${lang}/admin/activity`}>Showing “{subject}” only. Show all</Link>}</form>
    {!rows.length ? <p>No changes recorded.</p> : <ul className="admin-list">{rows.slice(0, pageSize).map(row => { const s = summary(row.details); return <li key={row.id} className="admin-row">
      <div><h3>{auditLabel(row.action)} <small>· {row.subject}</small></h3><p><small>{s.text}</small></p></div>
      <div className="admin-row-actions"><small>{s.actor ? `by ${s.actor} · ` : ""}{pickupDate(new Date(row.occurred_at).toISOString(), "en")}</small></div></li>; })}</ul>}
    <p>{page > 1 && <Link href={link(page - 1)}>← Newer</Link>}{page > 1 && more && " · "}{more && <Link href={link(page + 1)}>Older →</Link>}</p>
  </section>;
}
