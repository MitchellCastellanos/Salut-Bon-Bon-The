"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Lang } from "./domain";
import { rewardsPath } from "./rewards-paths";

export function StoreNavigation({ lang, showRewards, orderHref, demo = false }: { lang: Lang; showRewards: boolean; orderHref: string; demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { const timeout = setTimeout(() => setOpen(false), 0); return () => clearTimeout(timeout); }, [pathname]);
  const fr = lang === "fr";
  const root = `/${lang}`;
  const links = [
    { href: root, label: fr ? "Accueil" : "Home" },
    { href: `${root}/catalog`, label: "Menu" },
    { href: `${root}#promotions`, label: "Promotions" },
    ...(showRewards ? [{ href: rewardsPath[lang], label: fr ? "Récompenses" : "Rewards" }] : []),
    { href: `${root}#find-us`, label: fr ? "Nous trouver" : "Find us" },
    ...(demo ? [{ href: `${root}/demo`, label: fr ? "Démo" : "Demo" }] : []),
  ];
  return <div className="store-nav-shell">
    <button className="store-nav-toggle" type="button" aria-expanded={open} aria-controls="store-nav-links" aria-label={fr ? "Ouvrir le menu de navigation" : "Open navigation menu"} onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{open ? "✕" : "☰"}</span><span>Menu</span>
    </button>
    <nav id="store-nav-links" className={open ? "store-nav-links is-open" : "store-nav-links"} aria-label={fr ? "Navigation principale" : "Main navigation"}>
      {links.map(item => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}
      <Link className="store-nav-mobile-order" href={orderHref} onClick={() => setOpen(false)}>{fr ? "Commander" : "Order"}</Link>
      <Link className="store-nav-mobile-account" href={`${root}/account`} onClick={() => setOpen(false)}>{fr ? "Mon compte" : "My account"}</Link>
    </nav>
  </div>;
}
