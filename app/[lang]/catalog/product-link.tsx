"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { catalogPositionKey } from "./restore-position";
export function CatalogProductLink({ productId, href, className, ariaLabel, children }: { productId: string; href: string; className?: string; ariaLabel?: string; children: ReactNode }) {
  return <Link href={href} className={className} aria-label={ariaLabel} onClick={() => {
    try { sessionStorage.setItem(catalogPositionKey, JSON.stringify({ href: location.pathname + location.search, id: productId, y: window.scrollY })); } catch { /* navigation works without storage */ }
  }}>{children}</Link>;
}
