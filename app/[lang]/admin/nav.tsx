import Link from "next/link";

export type AdminSection = "home" | "orders" | "catalog" | "prices" | "hours" | "business" | "customers" | "rewards" | "analytics" | "campaigns" | "team";

const items: { id: AdminSection; path: string; label: [string, string] }[] = [
  { id: "home", path: "/admin", label: ["Tableau de bord", "Dashboard"] },
  { id: "orders", path: "/staff", label: ["Commandes", "Orders"] },
  { id: "catalog", path: "/admin/catalog", label: ["Menu", "Menu"] },
  { id: "prices", path: "/admin/prices", label: ["Prix", "Prices"] },
  { id: "hours", path: "/admin/hours", label: ["Heures", "Hours"] },
  { id: "business", path: "/admin/business", label: ["Commerce et taxes", "Business and tax"] },
  { id: "customers", path: "/admin/customers", label: ["Clients", "Customers"] },
  { id: "rewards", path: "/admin/rewards", label: ["Récompenses", "Rewards"] },
  { id: "analytics", path: "/admin/analytics", label: ["Audience", "Analytics"] },
  { id: "campaigns", path: "/admin/campaigns", label: ["Campagnes", "Campaigns"] },
  { id: "team", path: "/admin/team", label: ["Équipe", "Team"] },
];
export const adminItems = items;

/** One navigation bar shared by every administration screen. */
export function AdminNav({ lang, current }: { lang: "fr" | "en"; current: AdminSection }) {
  const fr = lang === "fr";
  return <nav className="panel admin-nav" aria-label={fr ? "Administration" : "Administration"}>
    {items.map((item, index) => <span key={item.id}>{index > 0 && " · "}
      <Link href={`/${lang}${item.path}`} aria-current={item.id === current ? "page" : undefined}>{item.id === current ? <strong>{item.label[fr ? 0 : 1]}</strong> : item.label[fr ? 0 : 1]}</Link></span>)}
  </nav>;
}
