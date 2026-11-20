"use client";

import { useRouter } from "next/navigation";
import { cartChanged, officialCartKey } from "../../../src/cart";
import { lineSchema } from "../../../src/domain";

/** Puts the lines of a previous order back in the cart; the menu revalidates them against the current catalog and prices at checkout. */
export function ReorderButton({ lines, label, href }: { lines: unknown[]; label: string; href: string }) {
  const router = useRouter();
  return <button type="button" className="outline" onClick={() => {
    const parsed = lineSchema.array().max(20).safeParse(lines);
    if (!parsed.success) return;
    try { localStorage.setItem(officialCartKey, JSON.stringify(parsed.data)); window.dispatchEvent(new Event(cartChanged)); } catch { /* cart unavailable */ }
    router.push(href);
  }}>{label}</button>;
}
