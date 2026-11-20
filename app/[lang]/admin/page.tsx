import Link from "next/link";
import { attention, report, reportRange } from "../../../src/admin-reports";
import { menuWarnings } from "../../../src/admin-menu";
import { scheduleOutlook } from "../../../src/pickup-policy";
import { pickupConfiguration } from "../../../src/store-settings";
import { adminPage } from "./guard";
import { Notice, PageHeader, Stat, money } from "./ui";
import { OrderingSwitch } from "./ordering-switch";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminHome({ params, searchParams }: PageProps<"/[lang]/admin">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const [config, needs, warnings, today, week] = await Promise.all([
    pickupConfiguration(), attention(), menuWarnings(),
    report(reportRange({ preset: "today" })), report(reportRange({ preset: "7" })),
  ]);
  const hoursToday = config.policy ? scheduleOutlook(config.policy)[0] : undefined;
  const items = [
    needs.stale > 0 && { text: `${needs.stale} new order(s) waiting more than 10 minutes to be confirmed`, href: `/${lang}/staff?status=RECEIVED` },
    needs.received > 0 && needs.stale === 0 && { text: `${needs.received} new order(s) to confirm`, href: `/${lang}/staff?status=RECEIVED` },
    needs.unpaid_ready > 0 && { text: `${needs.unpaid_ready} order(s) ready for pickup but not paid yet`, href: `/${lang}/staff?status=READY` },
    needs.refunds > 0 && { text: `${needs.refunds} cancelled paid order(s) need a refund`, href: `/${lang}/admin/orders?payment=REFUND_REQUIRED` },
    needs.failed_mail > 0 && { text: `${needs.failed_mail} email(s) failed to send`, href: `/${lang}/admin/notifications?status=FAILED` },
    warnings.soldout > 0 && { text: `${warnings.soldout} drink(s) marked sold out`, href: `/${lang}/admin/menu?status=soldout` },
    warnings.unpriced > 0 && { text: `${warnings.unpriced} drink(s) are on the menu but have no approved price, so customers cannot order them`, href: `/${lang}/admin/menu?status=unpriced` },
    warnings.sample > 0 && { text: `${warnings.sample} drink(s) still use sample prices`, href: `/${lang}/admin/menu?status=sample` },
  ].filter(Boolean) as { text: string; href: string }[];
  return <section className="wrap">
    <PageHeader title="Administration" intro="What needs your attention right now, and the shortcuts you use every day."/>
    <Notice saved={query.saved} saves={{ paused: "New online orders are paused. Customers now see that ordering is closed.", resumed: "Online ordering resumed.", demo: "Demo settings applied." }}/>
    {query.demo === "ready" && <p role="status" className="notice notice-good">Demo settings applied: ordering is open, every priced product is offered and the Rewards program is active.</p>}
    <OrderingSwitch lang={lang} flag={config.flag} blockers={config.blockers} back="dashboard"/>
    <h2>Needs attention</h2>
    {items.length ? <ul className="admin-list">{items.map(item => <li key={item.text} className="admin-row"><span>{item.text}</span><div className="admin-row-actions"><Link className="outline" href={item.href}>Open</Link></div></li>)}</ul>
      : <p className="notice notice-good">Nothing needs your attention.</p>}
    <h2>Orders right now</h2>
    <div className="stats">
      <Stat label="New" value={needs.received} href={`/${lang}/staff?status=RECEIVED`}/>
      <Stat label="Confirmed" value={needs.confirmed} href={`/${lang}/staff?status=CONFIRMED`}/>
      <Stat label="Preparing" value={needs.preparing} href={`/${lang}/staff?status=PREPARING`}/>
      <Stat label="Ready for pickup" value={needs.ready} href={`/${lang}/staff?status=READY`}/>
      <Stat label="Completed today" value={needs.completed_today} href={`/${lang}/admin/orders?status=COMPLETED&from=${today.range.from}`}/>
    </div>
    <h2>Sales</h2>
    <div className="stats">
      <Stat label="Today" value={money(today.sales.cents)} note={`${today.orders.placed - today.orders.cancelled} order(s)`}/>
      <Stat label="Last 7 days" value={money(week.sales.cents)} note={`${week.orders.placed - week.orders.cancelled} order(s) · average ${money(week.sales.averageCents)}`}/>
      <Stat label="Today’s hours" value={hoursToday ? (hoursToday.intervals.length ? hoursToday.intervals.map(([a, b]) => `${a}–${b}`).join(", ") : "Closed") : "Not set"} note={hoursToday?.reason ?? <Link href={`/${lang}/admin/hours`}>Change hours</Link>}/>
    </div>
    <p className="admin-hint">Sales count paid orders only, minus refunds. Test (simulated) payments are never included. <Link href={`/${lang}/admin/reports`}>Full reports</Link></p>
    <h2>Quick actions</h2>
    <div className="admin-row-actions" style={{ justifyContent: "flex-start" }}>
      <Link className="button" href={`/${lang}/staff`}>Open the live queue</Link>
      <Link className="outline" href={`/${lang}/staff/counter`}>Counter sale</Link>
      <Link className="outline" href={`/${lang}/staff/rewards`}>Scan a loyalty card</Link>
      <Link className="outline" href={`/${lang}/admin/menu`}>Mark a drink sold out</Link>
      <Link className="outline" href={`/${lang}/admin/hours#closures`}>Add a closure</Link>
    </div>
  </section>;
}
