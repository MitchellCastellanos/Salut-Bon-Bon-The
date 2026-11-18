"use client";
import { useSyncExternalStore } from "react";
import { cartChanged, cartKey } from "./cart";
import { lineSchema } from "./domain";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(cartChanged, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(cartChanged, callback);
  };
}
function count() {
  try {
    const result = lineSchema.array().safeParse(JSON.parse(localStorage.getItem(cartKey) || "[]"));
    return result.success ? result.data.reduce((sum, line) => sum + line.quantity, 0) : 0;
  } catch {
    return 0;
  }
}
export function CartCount() {
  const quantity = useSyncExternalStore(subscribe, count, () => 0);
  return <span id="header-cart-count" className="cart-count">{quantity}</span>;
}
