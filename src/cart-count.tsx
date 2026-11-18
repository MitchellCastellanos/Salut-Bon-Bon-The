"use client";
import { useSyncExternalStore } from "react";
import { cartChanged, cartKey, officialCartKey } from "./cart";
import { lineSchema } from "./domain";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(cartChanged, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(cartChanged, callback);
  };
}
function count(key: string) {
  try {
    const result = lineSchema.array().safeParse(JSON.parse(localStorage.getItem(key) || "[]"));
    return result.success ? result.data.reduce((sum, line) => sum + line.quantity, 0) : 0;
  } catch {
    return 0;
  }
}
const demoCount = () => count(cartKey);
const officialCount = () => count(officialCartKey);

export function CartCount({ official = false }: { official?: boolean }) {
  const quantity = useSyncExternalStore(subscribe, official ? officialCount : demoCount, () => 0);
  return <span id="header-cart-count" className="cart-count">{quantity}</span>;
}
