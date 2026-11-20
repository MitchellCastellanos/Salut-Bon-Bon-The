import Link from "next/link";
import { analyticsEnabled } from "../../../../src/analytics";
import { presets, report, reportRange } from "../../../../src/admin-reports";
import { database } from "../../../../src/db";
import { adminPage } from "../guard";
import { PageHeader, Stat, money } from "../ui";

export const metadata = { robots: { index: false, follow: false } };
const eventLabels: Record<string, string> = {
  page_view: "Page views", hero_impression: "Homepage banner views", hero_click: "Homepage banner clicks", campaign_click: "Campaign clicks", collection_visit: "Collection visits",
  category_click: "Category clicks", product_view: "Drink pages viewed", add_to_cart: "Added to cart", checkout_start: "Checkouts started", completed_order: "Orders placed",
};

export default async function Reports({ params, searchParams }: PageProps<"/[lang]/admin/reports">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const str = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  const range = reportRange({ preset: str("preset"), from: str("from"), to: str("to") });
  const data = await report(range);
  const enabled = analyticsEnabled();
  const { rows: visits } = enabled ? await (await database()).query<{ event: string; total: number }>(`
    SELECT event, count(*)::int AS total FROM marketing_events
    WHERE occurred_at >= ($1::date)::timestamp AT TIME ZONE 'America/Toronto' AND occurred_at < (($2::date) + 1)::timestamp AT TIME ZONE 'America/Toronto' GROUP BY event ORDER BY total DESC`, [range.from, range.to]) : { rows: [] };
  const peak = Math.max(1, ...data.byDay.map(row => row.cents));
  const top = Math.max(1, ...data.products.map(row => row.units));
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;
  const orderLink = (extra = "") => `/${lang}/admin/orders?from=${range.from}&to=${range.to}${extra}`;
  return <section className="wrap">
    <PageHeader title="Sales and activity" intro={<>From {range.from} to {range.to} ({days} day{days === 1 ? "" : "s"}). Every figure comes from your real orders, refunds and loyalty records.</>}/>
    <nav className="filter-chips" aria-label="Date range">
      {presets.map(p => <Link key={p.id} href={`/${lang}/admin/reports?preset=${p.id}`} aria-current={range.preset === p.id}>{p.label}</Link>)}
    </nav>
    <form className="catalog-filters" aria-label="Custom date range">
      <label>From<input type="date" name="from" defaultValue={range.from} max={range.to} required/></label>
      <label>To<input type="date" name="to" defaultValue={range.to} required/></label>
      <button className="outline">Show</button>
    </form>
    <h2>Sales</h2>
    <div className="stats">
      <Stat label="Sales" value={money(data.sales.cents)} note="paid orders, minus refunds, tax included"/>
      <Stat label="Orders" value={data.orders.placed - data.orders.cancelled} note={`${data.orders.online} online · ${data.orders.counter} counter`} href={orderLink()}/>
      <Stat label="Average order" value={money(data.sales.averageCents)}/>
      <Stat label="Refunded" value={money(data.sales.refundedCents)} href={orderLink("&payment=REFUNDED")}/>
      <Stat label="Cancelled" value={data.orders.cancelled} href={orderLink("&status=CANCELLED")}/>
    </div>
    {(data.sales.awaitingCents > 0 || data.sales.simulatedCents > 0) && <p className="admin-hint">
      {data.sales.awaitingCents > 0 && <>Not counted yet: {money(data.sales.awaitingCents)} in orders still waiting for payment. </>}
      {data.sales.simulatedCents > 0 && <>Not counted: {money(data.sales.simulatedCents)} in simulated test payments (no money moved).</>}</p>}
    <h2>Sales by day</h2>
    {!data.byDay.length ? <p>No orders in this period.</p> : <ul className="bars" aria-label="Sales by day">
      {data.byDay.map(row => <li key={row.day}><span>{row.day}</span><progress max={peak} value={row.cents} aria-label={`${row.day} sales`}/><b>{money(row.cents)} · {row.orders}</b></li>)}</ul>}
    <p className="admin-hint">Each line shows paid sales and the number of orders placed that day.</p>
    <h2>Most ordered drinks</h2>
    {!data.products.length ? <p>No orders in this period.</p> : <ol className="bars" style={{ paddingLeft: 0, listStyle: "none" }}>
      {data.products.map(row => <li key={row.id}><span>{row.name}</span><progress max={top} value={row.units} aria-label={`${row.name} units`}/><b>{row.units} sold · {money(row.cents)}</b></li>)}</ol>}
    <h2>Salut Rewards</h2>
    <div className="stats">
      <Stat label="Members" value={data.loyalty.members} note="all time" href={`/${lang}/admin/customers`}/>
      <Stat label="New members" value={data.loyalty.joined}/>
      <Stat label="Members who earned or redeemed" value={data.loyalty.active}/>
      <Stat label="Stamps earned" value={data.loyalty.stamps}/>
      <Stat label="Free drinks redeemed" value={data.loyalty.redemptions} href={`/${lang}/admin/rewards`}/>
      <Stat label="Orders by a member" value={data.loyalty.ordersWithMember} note={`of ${data.orders.placed - data.orders.cancelled}`}/>
    </div>
    <h2>Website visits</h2>
    {!enabled ? <p className="notice notice-warn">Visit measurement is switched off. When your web team turns it on, only visitors who accept it are counted, with no personal data.</p>
      : !visits.length ? <p>No visits recorded in this period.</p> : <ul className="bars">{visits.map(row => <li key={row.event}><span>{eventLabels[row.event] ?? row.event}</span><progress max={Math.max(1, ...visits.map(v => v.total))} value={row.total}/><b>{row.total}</b></li>)}</ul>}
  </section>;
}
