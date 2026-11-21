import Link from "next/link";
import type { Lang } from "../../src/domain";
import { demoMode } from "../../src/demo-mode";
import { staffProfile, staffRole } from "../../src/staff";
import { logout } from "./staff/actions";
import { ConsoleSidebar, type ConsoleSection } from "./console-sidebar";

/** The administration and staff area has its own frame: no public header or footer, a grouped sidebar and a way back to the site. */
export async function ConsoleShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const [role, profile] = await Promise.all([staffRole(), staffProfile()]);
  const siteHref = "/fr";
  if (!role) return <main id="main" className="console-login">
    <Link className="console-back" href={siteHref}>← Back to the website</Link>
    {children}
  </main>;
  const p = `/${lang}`;
  const orders: ConsoleSection = { title: "Orders", links: [
    { href: `${p}/staff`, label: "Live queue" },
    ...(role === "ADMIN" ? [{ href: `${p}/admin/orders`, label: "Order history" }] : []),
    { href: `${p}/staff/counter`, label: "Counter sale" },
  ] };
  const sections: ConsoleSection[] = role === "ADMIN" ? [
    { title: "", links: [{ href: `${p}/admin`, label: "Dashboard" }] },
    orders,
    { title: "Menu", links: [
      { href: `${p}/admin/menu`, label: "Drinks and prices" },
      { href: `${p}/admin/menu/options`, label: "Categories and toppings" },
    ] },
    { title: "Customers and loyalty", links: [
      { href: `${p}/admin/customers`, label: "Customers" },
      { href: `${p}/admin/rewards`, label: "Rewards program" },
      { href: `${p}/staff/rewards`, label: "Scan a card" },
      { href: `${p}/admin/wallet`, label: "Digital cards" },
    ] },
    { title: "Store", links: [
      { href: `${p}/admin/hours`, label: "Hours and online ordering" },
      { href: `${p}/admin/business`, label: "Business info and tax" },
      { href: `${p}/admin/team`, label: "Staff and access" },
    ] },
    { title: "Reports", links: [{ href: `${p}/admin/reports`, label: "Sales and activity" }] },
    { title: "Settings", links: [
      { href: `${p}/admin/website`, label: "Website content" },
      { href: `${p}/admin/notifications`, label: "Notifications" },
      { href: `${p}/admin/integrations`, label: "Payments and integrations" },
      { href: `${p}/admin/activity`, label: "Change history" },
    ] },
  ] : [{ ...orders, links: [...orders.links, { href: `${p}/staff/rewards`, label: "Scan a card" }] }];
  return <div className="console">
    <a className="skip-link" href="#main">Skip to content</a>
    <ConsoleSidebar lang={lang} sections={sections} name={profile?.name ?? ""} role={role} siteHref={siteHref} logout={logout.bind(null, lang)}/>
    <main id="main" className="console-main" tabIndex={-1}>
      {demoMode() && <p className="panel" role="note" style={{ marginBottom: 16 }}><strong>Demo store.</strong> Nothing is charged and no email is sent. This is the screen your team uses to receive and prepare orders.</p>}
      {children}
    </main>
  </div>;
}
