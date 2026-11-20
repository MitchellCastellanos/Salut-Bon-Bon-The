"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { catalogPositionKey } from "./restore-position";
export function CatalogBackLink({ lang, productId, category }: { lang: string; productId: string; category: string }) {
  const fallback = `/${lang}/catalog?category=${encodeURIComponent(category)}#${encodeURIComponent(productId)}`;
  const [href, setHref] = useState(fallback);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(catalogPositionKey) || "null") as { href: string; id: string } | null;
      if (saved?.id === productId && saved.href.startsWith(`/${lang}/catalog`)) setHref(saved.href);
    } catch { /* fallback */ }
  }, [lang, productId]);
  return <Link className="outline" href={href}>← {lang === "fr" ? "Retour au catalogue" : "Back to catalog"}</Link>;
}
