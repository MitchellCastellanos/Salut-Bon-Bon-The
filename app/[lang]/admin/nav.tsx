export type AdminSection = "home" | "orders" | "counter" | "catalog" | "prices" | "hours" | "business" | "customers" | "rewards" | "analytics" | "campaigns" | "team";

const items: { id: AdminSection; path: string; label: [string, string] }[] = [
  { id: "home", path: "/admin", label: ["Tableau de bord", "Dashboard"] },
  { id: "orders", path: "/staff", label: ["Commandes", "Orders"] },
  { id: "counter", path: "/staff/counter", label: ["Vente au comptoir", "Counter sale"] },
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
