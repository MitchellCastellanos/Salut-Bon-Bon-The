import Link from "next/link";
import { database } from "../../../../src/db";
import { money, pickupDate } from "../../../../src/domain";
import { adminPage } from "../guard";
import { Badge, PageHeader } from "../ui";

export const metadata = { robots: { index: false, follow: false } };
const pageSize = 25;

export default async function AdminCustomers({ params, searchParams }: PageProps<"/[lang]/admin/customers">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.min(10000, Number(typeof query.page === "string" ? query.page : 1) || 1));
  const db = await database();
  const filter = `u."role" = 'CUSTOMER' AND ($1 = '' OR position(lower($1) in lower(u."email")) > 0 OR position(lower($1) in lower(u."name")) > 0 OR upper(a.member_code) = upper($1))`;
  const [{ rows }, { rows: [count] }] = await Promise.all([
    db.query<{ id: string; name: string; email: string; verified: boolean; created_at: Date | string; balance: number | null; member_code: string | null; status: string | null; orders: number; spent: number }>(`
      SELECT u."id", u."name", u."email", u."emailVerified" AS verified, u."createdAt" AS created_at, a.balance, a.member_code, a.status,
        (SELECT count(*)::int FROM orders o WHERE o.customer_user_id = u."id" AND o.status <> 'CANCELLED') AS orders,
        (SELECT coalesce(sum(o.total), 0)::int FROM orders o WHERE o.customer_user_id = u."id" AND o.status = 'COMPLETED') AS spent
      FROM "user" u LEFT JOIN loyalty_accounts a ON a.user_id = u."id" WHERE ${filter} ORDER BY u."createdAt" DESC LIMIT ${pageSize} OFFSET $2`, [q, (page - 1) * pageSize]),
    db.query<{ n: number }>(`SELECT count(*)::int AS n FROM "user" u LEFT JOIN loyalty_accounts a ON a.user_id = u."id" WHERE ${filter}`, [q]),
  ]);
  const pages = Math.max(1, Math.ceil(count.n / pageSize));
  const link = (p: number) => `/${lang}/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return <section className="wrap">
    <PageHeader title="Customers" intro={`${count.n} customer account(s). Personal details are visible to administrators only. To find someone at the counter, search by name, email or card number.`}/>
    <form className="catalog-filters" role="search"><label>Name, email or card number<input name="q" maxLength={100} defaultValue={q}/></label><button className="outline">Search</button></form>
    {!rows.length ? <p>{q ? "No customer matches your search." : "No customer has signed up yet."}</p> : <ul className="admin-list">{rows.map(row => <li key={row.id} className="admin-row">
      <div><h3><Link href={`/${lang}/admin/customers/${row.id}`}>{row.name}</Link> {!row.verified && <Badge tone="warn">email not confirmed</Badge>} {row.status === "suspended" && <Badge tone="bad">rewards suspended</Badge>}</h3>
        <p>{row.email} · joined {pickupDate(new Date(row.created_at).toISOString(), "en")} · {row.orders} order(s) · {money(row.spent, "en")} spent</p></div>
      <div className="admin-row-actions">{row.balance === null ? <Badge>not in Rewards</Badge> : <Badge tone="good">{row.balance} stamp(s) · {row.member_code}</Badge>}</div>
    </li>)}</ul>}
    <p>{page > 1 && <Link href={link(page - 1)}>← Previous</Link>}{page > 1 && page < pages && " · "}{page < pages && <Link href={link(page + 1)}>Next →</Link>} <small>Page {page} of {pages}</small></p>
  </section>;
}
