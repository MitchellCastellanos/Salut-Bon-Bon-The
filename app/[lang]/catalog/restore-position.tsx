"use client";
import { useEffect } from "react";
export const catalogPositionKey = "salut-catalog-return";
export function RestoreCatalogPosition() {
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const restore = () => {
      if (cancelled) return;
      try {
        const saved = JSON.parse(sessionStorage.getItem(catalogPositionKey) || "null") as { href: string; id: string; y: number } | null;
        if (!saved || saved.href !== location.pathname + location.search) return;
        const target = document.getElementById(saved.id);
        if (target) {
          window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 110), behavior: "instant" });
          sessionStorage.removeItem(catalogPositionKey);
        } else if (++attempts < 15) window.setTimeout(restore, 100);
      } catch { /* Ignore blocked storage. */ }
    };
    const timer = window.setTimeout(restore, 60);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  return null;
}
