import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language, money, pickupDate } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";

export const metadata = { robots: { index: false, follow: false } };
const pageSize = 25;

export default async function AdminCustomers({ params, searchParams }: PageProps<"/[lang]/admin/customers">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.min(10000, Number(typeof query.page === "string" ? query.page : 1) || 1));
  const db = await database();
  const filter = `u."role" = 'CUSTOMER' AND ($1 = '' OR position(lower($1) in lower(u."email")) > 0 OR position(lower($1) in lower(u."name")) > 0)`;
  const [{ rows }, { rows: [count] }] = await Promise.all([
    db.query<{ id: string; name: string; email: string; verified: boolean; created_at: Date | string; balance: number | null; member_code: string | null; orders: number; spent: number }>(`
      SELECT u."id", u."name", u."email", u."emailVerified" AS verified, u."createdAt" AS created_at, a.balance, a.member_code,
        (SELECT count(*)::int FROM orders o WHERE o.customer_user_id = u."id" AND o.status <> 'CANCELLED') AS orders,
        (SELECT coalesce(sum(o.total), 0)::int FROM orders o WHERE o.customer_user_id = u."id" AND o.status = 'COMPLETED') AS spent
      FROM "user" u LEFT JOIN loyalty_accounts a ON a.user_id = u."id"
      WHERE ${filter} ORDER BY u."createdAt" DESC LIMIT ${pageSize} OFFSET $2`, [q, (page - 1) * pageSize]),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" u WHERE ${filter}`, [q]),
  ]);
  const pages = Math.max(1, Math.ceil(count.n / pageSize));
  const link = (p: number) => `/${lang}/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return <section className="wrap catalog-page">
    <h1>{fr ? "Clients" : "Customers"}</h1>
    <p>{fr ? `${count.n} compte(s) client. Données de contact visibles par l’administration seulement.` : `${count.n} customer account(s). Contact data is visible to administrators only.`}</p>
    <form className="catalog-filters" role="search"><label>{fr ? "Nom ou courriel" : "Name or email"}<input name="q" maxLength={100} defaultValue={q}/></label><button className="outline">{fr ? "Chercher" : "Search"}</button></form>
    {!rows.length ? <p>{fr ? "Aucun client." : "No customers."}</p> : <div className="table-scroll"><table className="price-table">
      <thead><tr><th>{fr ? "Nom" : "Name"}</th><th>{fr ? "Courriel" : "Email"}</th><th>{fr ? "Inscrit le" : "Joined"}</th><th>{fr ? "Commandes" : "Orders"}</th><th>{fr ? "Dépensé" : "Spent"}</th><th>{fr ? "Tampons" : "Stamps"}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}>
        <td><Link href={`/${lang}/admin/customers/${row.id}`}>{row.name}</Link></td>
        <td>{row.email}{!row.verified && <small> ({fr ? "non confirmé" : "unconfirmed"})</small>}</td>
        <td>{pickupDate(new Date(row.created_at).toISOString(), lang)}</td><td>{row.orders}</td><td>{money(row.spent, lang)}</td>
        <td>{row.balance ?? "—"}{row.member_code && <small> · {row.member_code}</small>}</td></tr>)}</tbody></table></div>}
    <p>{page > 1 && <Link href={link(page - 1)}>← {fr ? "Précédent" : "Previous"}</Link>}{page > 1 && page < pages && " · "}{page < pages && <Link href={link(page + 1)}>{fr ? "Suivant" : "Next"} →</Link>} <small>{page}/{pages}</small></p>
  </section>;
}
