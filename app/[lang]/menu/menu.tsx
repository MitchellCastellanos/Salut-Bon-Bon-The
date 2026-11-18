"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { categories, lineSchema, modifiers, money, pickupDate, products, quote, type Lang, type Line } from "../../../src/domain";
import { slots, submitOrder } from "./actions";

const key = "salut-cart";
const errors: Record<string, [string, string]> = {
  SLOT: ["Choisis une nouvelle heure de cueillette.", "Choose a new pickup time."],
  MENU: ["Vérifie les options de ton panier.", "Check your cart options."],
  CONFLICT: ["Cette commande existe déjà avec d’autres détails.", "This order already exists with different details."],
};
export function Menu({ lang, demo, photos }: { lang: Lang; demo: boolean; photos: Record<string, ReactNode> }) {
  const fr = lang === "fr";
  const router = useRouter();
  const customization = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<"all" | keyof typeof categories>("all");
  const [selected, setSelected] = useState<(typeof products)[number]>();
  const [cart, setCart] = useState<Line[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const init = window.setTimeout(() => {
      try {
        const saved = lineSchema.array().max(20).parse(JSON.parse(localStorage.getItem(key) || "[]"));
        quote(saved);
        setCart(saved);
      } catch { /* An invalid or unavailable cart starts empty. */ }
      setReady(true);
    }, 0);
    slots().then(setTimes).catch(() => setError(fr ? "Heures indisponibles." : "Pickup times unavailable."));
    return () => window.clearTimeout(init);
  }, [fr]);
  useEffect(() => {
    if (selected) customization.current?.querySelector("select")?.focus();
  }, [selected]);
  function save(lines: Line[]) {
    setCart(lines);
    try { localStorage.setItem(key, JSON.stringify(lines)); } catch { /* Keep the current cart usable. */ }
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !ready || cart.length >= 20) return;
    const form = new FormData(event.currentTarget);
    const line = lineSchema.parse({ ...Object.fromEntries(form), product: selected.id, quantity: Number(form.get("quantity")) });
    save([...cart, line]);
    setMessage(fr ? "Boisson ajoutée au panier." : "Drink added to cart.");
    setSelected(undefined);
  }
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...form, lang, lines: cart };
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
      let request = crypto.randomUUID();
      try {
        const pending = JSON.parse(sessionStorage.getItem("salut-checkout") || "null");
        if (pending?.fingerprint === fingerprint) request = pending.request;
        sessionStorage.setItem("salut-checkout", JSON.stringify({ request, fingerprint }));
      } catch { /* The order remains usable when storage is unavailable. */ }
      const result = await submitOrder({ ...payload, request });
      if (result.token) {
        save([]);
        try { sessionStorage.removeItem("salut-checkout"); } catch { /* Storage can be disabled. */ }
        router.push(`/${lang}/track/${result.token}`);
        return;
      }
      const localized = errors[result.error ?? "FAILED"];
      setError(localized ? localized[fr ? 0 : 1] : fr ? "Commande indisponible. Réessaie." : "Could not place the order. Try again.");
      if (result.error === "SLOT") setTimes(await slots());
    } catch {
      setError(fr ? "Connexion interrompue. Réessaie." : "Connection interrupted. Try again.");
    } finally { setBusy(false); }
  }
  const priced = quote(cart);
  return <div className="menu-layout">
    <div>
      <div className="filters">{(["all", "fruit", "milk"] as const).map(id => <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{id === "all" ? fr ? "Tout" : "All" : categories[id][lang]}</button>)}</div>
      <div className="product-grid menu-grid">{products.filter(p => category === "all" || category === p.category).map(p => <article className="product-card" id={p.id} key={p.id}>
        {photos[p.id]}<div><strong>{p.name[lang]}</strong><span>{money(p.price, lang)}</span></div><p>{p.description[lang]}</p>
        <button className="outline" onClick={() => setSelected(p)}>{fr ? "Personnaliser" : "Customize"} ＋</button>
      </article>)}</div>
      {selected && <form ref={customization} className="panel customize" key={selected.id} onSubmit={add}><h2>{selected.name[lang]}</h2>
        <div className="fields">
          <label>{fr ? "Format" : "Size"}<select name="size">{(["regular", "large"] as const).map(s => <option key={s} value={s}>{modifiers[s][lang]}{s === "large" ? ` +${money(100, lang)}` : ""}</option>)}</select></label>
          <label>{fr ? "Sucre" : "Sugar"}<select name="sugar" defaultValue="100">{["0", "50", "100"].map(s => <option key={s} value={s}>{s}%</option>)}</select></label>
          <label>{fr ? "Glace" : "Ice"}<select name="ice" defaultValue="100">{["0", "50", "100"].map(s => <option key={s} value={s}>{s}%</option>)}</select></label>
          <label>{fr ? "Garniture" : "Topping"}<select name="topping">{selected.topping.map(s => <option key={s} value={s}>{modifiers[s][lang]}{s !== "none" ? ` +${money(75, lang)}` : ""}</option>)}</select></label>
          <label>{fr ? "Quantité" : "Quantity"}<input name="quantity" type="number" min={1} max={10} defaultValue={1} required/></label>
        </div>
        <button className="button" disabled={!ready || cart.length >= 20}>{fr ? "Ajouter au panier" : "Add to cart"}</button>{" "}
        <button className="outline" type="button" onClick={() => setSelected(undefined)}>{fr ? "Fermer" : "Close"}</button>
      </form>}
      <p role="status">{message}</p>
    </div>
    <aside className="panel cart"><h2>{fr ? "Ton panier" : "Your cart"}</h2>
      {!priced.length ? <p>{fr ? "Ton panier est vide." : "Your cart is empty."}</p> : <>
        <ul className="cart-lines">{priced.map((item, index) => <li key={index}><div><strong>{item.quantity} × {item.name[lang]}</strong><small>{modifiers[item.size][lang]} · {modifiers[item.topping][lang]} · {fr ? "sucre" : "sugar"} {item.sugar}% · {fr ? "glace" : "ice"} {item.ice}%</small></div><div>{money(item.subtotal, lang)} <button type="button" className="remove" aria-label={fr ? `Retirer ${item.name[lang]}` : `Remove ${item.name[lang]}`} onClick={() => save(cart.filter((_, i) => index !== i))}>×</button></div></li>)}</ul>
        <p className="total">{fr ? "Total démo" : "Demo total"} <strong>{money(priced.reduce((sum, item) => sum + item.subtotal, 0), lang)}</strong></p>
        <form className="checkout" onSubmit={checkout}>
          <label>{fr ? "Nom pour la cueillette" : "Pickup name"}<input name="name" required maxLength={80} autoComplete="given-name"/></label>
          <label>{fr ? "Heure de cueillette" : "Pickup time"}<select required name="pickup" defaultValue=""><option value="" disabled>{fr ? "Choisir une heure" : "Choose a time"}</option>{times.map(time => <option key={time} value={time}>{pickupDate(time, lang)}</option>)}</select></label>
          <label>{fr ? "Note facultative" : "Optional note"}<input name="notes" maxLength={240}/></label>
          <label>{fr ? "Paiement" : "Payment"}<select name="method"><option value="pickup">{fr ? "Payer à la cueillette" : "Pay at pickup"}</option>{demo && <option value="demo">{fr ? "Paiement simulé · aucun débit" : "Simulated payment · no charge"}</option>}</select></label>
          <button className="button" disabled={busy || !times.length}>{busy ? fr ? "Envoi…" : "Sending…" : fr ? "Passer la commande" : "Place order"}</button>
        </form>
      </>}
      {error && <p role="alert">{error}</p>}
    </aside>
  </div>;
}
