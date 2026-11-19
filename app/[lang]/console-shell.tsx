import Link from "next/link";
import type { Lang } from "../../src/domain";
import { staffProfile, staffRole } from "../../src/staff";
import { logout } from "./staff/actions";
import { ConsoleSidebar, type ConsoleSection } from "./console-sidebar";

/** The administration and staff area has its own frame: no public header or footer, a grouped sidebar and a way back to the site. */
export async function ConsoleShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const fr = lang === "fr";
  const [role, profile] = await Promise.all([staffRole(), staffProfile()]);
  const siteHref = "/fr";
  if (!role) return <main id="main" className="console-login">
    <Link className="console-back" href={siteHref}>← {fr ? "Retour au site" : "Back to the website"}</Link>
    {children}
  </main>;
  const p = `/${lang}`;
  const sales: ConsoleSection = { title: fr ? "Ventes" : "Sales", links: [
    { href: `${p}/staff`, label: fr ? "Commandes" : "Orders" },
    { href: `${p}/staff/counter`, label: fr ? "Vente au comptoir" : "Counter sale" },
  ] };
  const sections: ConsoleSection[] = role === "ADMIN" ? [
    { title: "", links: [{ href: `${p}/admin`, label: fr ? "Tableau de bord" : "Dashboard" }] },
    sales,
    { title: "Menu", links: [
      { href: `${p}/admin/catalog`, label: fr ? "Produits et catalogue" : "Products and catalog" },
      { href: `${p}/admin/prices`, label: fr ? "Prix" : "Prices" },
      { href: `${p}/admin/campaigns`, label: fr ? "Campagnes" : "Campaigns" },
    ] },
    { title: fr ? "Commerce" : "Business", links: [
      { href: `${p}/admin/hours`, label: fr ? "Heures et cueillette" : "Hours and pickup" },
      { href: `${p}/admin/business`, label: fr ? "Profil et taxes" : "Profile and tax" },
    ] },
    { title: fr ? "Clients" : "Customers", links: [
      { href: `${p}/admin/customers`, label: fr ? "Clients" : "Customers" },
      { href: `${p}/admin/rewards`, label: fr ? "Récompenses" : "Rewards" },
      { href: `${p}/staff/rewards`, label: fr ? "Scanner une carte" : "Scan a card" },
    ] },
    { title: "Site", links: [
      { href: `${p}/admin/analytics`, label: fr ? "Audience" : "Analytics" },
      { href: `${p}/admin/team`, label: fr ? "Équipe et accès" : "Team and access" },
    ] },
  ] : [{ ...sales, links: [...sales.links, { href: `${p}/staff/rewards`, label: fr ? "Scanner une carte" : "Scan a card" }] }];
  return <div className="console">
    <ConsoleSidebar lang={lang} sections={sections} name={profile?.name ?? ""} role={role} siteHref={siteHref} logout={logout.bind(null, lang)}/>
    <main id="main" className="console-main">{children}</main>
  </div>;
}
