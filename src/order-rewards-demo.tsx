"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import catalog from "../catalog/official.json";
import { pointsFor } from "./rewards-math";

type Lang = "fr" | "en";
type Item = { product: string; size: "regular" | "large"; topping: "none" | "pearls" | "popping"; quantity: number };
type ServerOrder = { id: string; token: string; name: string; lines: Array<Item & { fr: string; en: string; subtotal: number }>; subtotal: number; total: number; points: number; pickup: string; status: number };
const key = "salut-isolated-demo-v2";
const rates: Record<string, number> = { "milk-tea": 595, "fruit-tea": 575, smoothies: 650, lemonade: 550, matcha: 675, "fresh-mango-series": 725, "creme-brulee": 750 };
const statuses = { fr: ["Reçue", "Confirmée", "En préparation", "Prête", "Remise"], en: ["Received", "Confirmed", "Preparing", "Ready", "Completed"] };
const money = (cents: number, lang: Lang) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
const price = (line: Item) => {
  const p = catalog.products.find(p => p.id === line.product);
  return ((p ? rates[p.category] : 0) + (line.size === "large" ? 100 : 0) + (line.topping === "none" ? 0 : 75)) * line.quantity;
};
const api = "/api/demo-orders";
export function OrderRewardsDemo({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const [product, setProduct] = useState(catalog.products[0].id);
  const [size, setSize] = useState<Item["size"]>("regular");
  const [topping, setTopping] = useState<Item["topping"]>("none");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [pickup, setPickup] = useState("");
  const [order, setOrder] = useState<ServerOrder | null>(null);
  const [view, setView] = useState<"customer" | "staff">("customer");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + price(line), 0), [cart]);
  const gst = Math.round(subtotal * 0.05), qst = Math.round(subtotal * 0.09975);
  const points = pointsFor(subtotal, 10);
  const refresh = useCallback(async (id: string, token: string) => {
    try {
      const response = await fetch(api + "?id=" + encodeURIComponent(id) + "&token=" + encodeURIComponent(token), { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setOrder(current => current && current.id === id ? { ...current, status: data.status, lines: data.lines, name: data.name, subtotal: data.subtotal_cents, total: data.total_cents, points: data.points, pickup: data.pickup } : null);
    } catch { /* Keep last known status until connection returns. */ }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id"), token = params.get("token");
    if (id && token) {
      const saved = { id, token, name: "", lines: [], subtotal: 0, total: 0, points: 0, pickup: "", status: 0 };
      queueMicrotask(() => setOrder(saved)); localStorage.setItem(key, JSON.stringify(saved));
    } else {
      try { const raw = localStorage.getItem(key); if (raw) { const restored = JSON.parse(raw); queueMicrotask(() => setOrder(restored)); } } catch { /* Browser storage is optional. */ }
    }
  }, []);
  useEffect(() => {
    if (!order?.id || !order.token) return;
    const immediate = setTimeout(() => void refresh(order.id, order.token), 0);
    const timer = setInterval(() => void refresh(order.id, order.token), 5000);
    return () => { clearTimeout(immediate); clearInterval(timer); };
  }, [order?.id, order?.token, refresh]);
  const add = () => {
    setCart(items => {
      const next: Item = { product, size, topping, quantity };
      const index = items.findIndex(item => item.product === product && item.size === size && item.topping === topping);
      if (index < 0) return [...items, next];
      return items.map((item, i) => i === index ? { ...item, quantity: Math.min(10, item.quantity + quantity) } : item);
    });
    setMessage(fr ? "Boisson ajoutée au panier." : "Drink added to cart.");
  };
  const place = async () => {
    if (!name.trim() || !pickup || !cart.length || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, pickup, lines: cart }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "DEMO_UNAVAILABLE");
      setOrder(data); localStorage.setItem(key, JSON.stringify(data)); setCart([]);
      window.history.replaceState(null, "", window.location.pathname + "?id=" + data.id + "&token=" + data.token);
    } catch (error) { setMessage((fr ? "Impossible de créer la commande fictive : " : "Could not create sample order: ") + (error instanceof Error ? error.message : "unknown")); }
    finally { setBusy(false); }
  };
  const advance = async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      const response = await fetch(api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, token: order.token }) });
      if (!response.ok) throw new Error("DEMO_UNAVAILABLE");
      const data = await response.json();
      setOrder({ ...order, status: data.status });
    } catch { setMessage(fr ? "Échec de mise à jour." : "Update failed."); }
    finally { setBusy(false); }
  };
  const share = async () => {
    if (!order) return;
    const url = window.location.origin + window.location.pathname + "?id=" + order.id + "&token=" + order.token;
    try { await navigator.clipboard.writeText(url); setMessage(fr ? "Lien privé copié. Toute personne ayant ce lien peut faire avancer la simulation." : "Private link copied. Anyone with this link can advance the simulation."); }
    catch { setMessage(url); }
  };
  const reset = () => { localStorage.removeItem(key); window.history.replaceState(null, "", window.location.pathname); setOrder(null); setView("customer"); setMessage(""); };
  const card = { background: "#fffdf9", border: "1px solid #ead8c6", borderRadius: 20, padding: 22 };
  const field = { display: "grid", gap: 6 };
  return <div className="wrap section" style={{ maxWidth: 1000 }}>
    <p className="eyebrow">{fr ? "Expérience interactive" : "Interactive experience"}</p>
    <h1>{fr ? "Votre commande, de A à Z" : "Your order, start to finish"}<span>.</span></h1>
    <p role="note" style={{ ...card, borderLeft: "5px solid #df422f" }}><strong>{fr ? "DÉMONSTRATION — AUCUNE VENTE RÉELLE" : "DEMONSTRATION — NO REAL SALE"}</strong><br/>{fr ? "Catalogue officiel, prix et taxes illustratifs, créneaux fictifs. Aucun paiement, courriel ou point de fidélité réel. Les commandes sont isolées de la boutique et expirent après 7 jours." : "Official catalog; sample prices, taxes and pickup slots. No payment, email or real loyalty credit. Orders are isolated from the store and expire after 7 days."}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "20px 0" }}>
      <button type="button" className={view === "customer" ? "button" : "outline"} onClick={() => setView("customer")}>{fr ? "Client" : "Customer"}</button>
      <button type="button" className={view === "staff" ? "button" : "outline"} onClick={() => setView("staff")}>{fr ? "Équipe (démo)" : "Staff (demo)"}</button>
      <Link className="outline" href={fr ? "/fr/recompenses" : "/en/rewards"}>{fr ? "Programme Récompenses" : "Rewards program"}</Link>
    </div>
    {message && <p role="status" style={{ ...card, overflowWrap: "anywhere" }}>{message}</p>}
    {!order && view === "customer" && <div style={{ display: "grid", gap: 20 }}>
      <section style={{ ...card, display: "grid", gap: 16 }}>
        <h2>{fr ? "1. Composez votre boisson" : "1. Build your drink"}</h2>
        <label style={field}>{fr ? "Boisson — 62 choix" : "Drink — 62 choices"}
          <select value={product} onChange={e => setProduct(e.target.value)}>{catalog.categories.map(category => <optgroup key={category.id} label={category[lang]}>{catalog.products.filter(p => p.category === category.id).map(p => <option key={p.id} value={p.id}>{p.code} · {p[lang]}</option>)}</optgroup>)}</select>
        </label>
        <label style={field}>{fr ? "Format" : "Size"}<select value={size} onChange={e => setSize(e.target.value as Item["size"])}><option value="regular">{fr ? "Régulier" : "Regular"}</option><option value="large">{fr ? "Grand (+1,00 $)" : "Large (+$1.00)"}</option></select></label>
        <label style={field}>{fr ? "Garniture fictive" : "Sample topping"}<select value={topping} onChange={e => setTopping(e.target.value as Item["topping"])}><option value="none">{fr ? "Aucune" : "None"}</option><option value="pearls">{fr ? "Tapioca (+0,75 $)" : "Tapioca (+$0.75)"}</option><option value="popping">{fr ? "Perles éclatantes (+0,75 $)" : "Popping pearls (+$0.75)"}</option></select></label>
        <label style={field}>{fr ? "Quantité" : "Quantity"}<input type="number" min="1" max="10" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}/></label>
        <button className="button" type="button" onClick={add}>{fr ? "Ajouter au panier" : "Add to cart"} · {money(price({ product, size, topping, quantity }), lang)}</button>
      </section>
      <section style={{ ...card, display: "grid", gap: 12 }}>
        <h2>{fr ? "2. Votre panier" : "2. Your cart"}</h2>
        {!cart.length && <p>{fr ? "Votre panier est vide." : "Your cart is empty."}</p>}
        {cart.map((item, index) => { const p = catalog.products.find(p => p.id === item.product); return <div key={index} style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #ead8c6", paddingBottom: 12 }}>
          <span>{item.quantity} × {p?.[lang]} · {item.size} · {item.topping}<br/><strong>{money(price(item), lang)}</strong></span>
          <button type="button" className="outline" onClick={() => setCart(lines => lines.filter((_, i) => i !== index))}>{fr ? "Retirer" : "Remove"}</button>
        </div>; })}
        <p>{fr ? "Sous-total" : "Subtotal"}: {money(subtotal, lang)} · TPS/GST: {money(gst, lang)} · TVQ/QST: {money(qst, lang)}</p>
        <h2>{fr ? "Total estimé" : "Estimated total"}: {money(subtotal + gst + qst, lang)}</h2>
        <p>🎁 <strong>{points} {fr ? "points potentiels" : "potential points"}</strong> · {fr ? "Valeur théorique" : "Theoretical value"} {money(Math.floor(points * 0.5), lang)} · {fr ? "Aucun point n'est crédité" : "No points are credited"}</p>
      </section>
      <section style={{ ...card, display: "grid", gap: 12 }}>
        <h2>{fr ? "3. Cueillette fictive" : "3. Sample pickup"}</h2>
        <label style={field}>{fr ? "Nom" : "Name"}<input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder={fr ? "Votre nom" : "Your name"}/></label>
        <label style={field}>{fr ? "Créneau fictif" : "Sample slot"}<select value={pickup} onChange={e => setPickup(e.target.value)}><option value="">{fr ? "Choisir" : "Choose"}</option>{["14:00","14:30","15:00","15:30"].map(t => <option key={t} value={t}>{t}</option>)}</select></label>
        <button className="button" type="button" disabled={busy || !name.trim() || !pickup || !cart.length} onClick={place}>{busy ? "…" : fr ? "Confirmer sans payer" : "Confirm without paying"}</button>
      </section>
    </div>}
    {order && <section style={{ ...card, display: "grid", gap: 14 }} aria-live="polite">
      <p className="eyebrow">DEMO · {order.id.slice(0, 8).toUpperCase()}</p>
      <h2>{view === "staff" ? fr ? "Tableau de préparation" : "Preparation board" : fr ? "Suivi de commande" : "Order tracking"}</h2>
      <p>{order.name} · {order.pickup} · <strong>{money(order.total, lang)}</strong></p>
      <ul>{order.lines.map((line, i) => <li key={i}>{line.quantity} × {line[lang]} · {line.size} · {money(line.subtotal, lang)}</li>)}</ul>
      <ol>{statuses[lang].map((status, i) => <li key={status} style={{ opacity: i <= order.status ? 1 : 0.4, padding: 4 }}>{i <= order.status ? "✓ " : "○ "}{status}</li>)}</ol>
      <p>🎁 {order.points} {fr ? "points fictifs (non crédités)" : "sample points (not credited)"}</p>
      {view === "staff" && <button className="button" type="button" disabled={busy || order.status >= 4} onClick={advance}>{fr ? "Étape suivante" : "Next status"}</button>}
      <button className="outline" type="button" onClick={share}>{fr ? "Copier le lien privé pour un autre appareil" : "Copy private link for another device"}</button>
      <button className="outline" type="button" onClick={reset}>{fr ? "Nouvelle démonstration" : "Start a new demo"}</button>
      <small>{fr ? "Le lien donne accès à la simulation et à ses changements d'état. Ne le partagez qu'avec les participants." : "The link grants access to the demo and status updates. Share only with participants."}</small>
    </section>}
    {!order && view === "staff" && <section style={card}><h2>{fr ? "Aucune commande sélectionnée" : "No order selected"}</h2><p>{fr ? "Créez une commande côté client, puis revenez ici ou ouvrez son lien privé sur un autre appareil." : "Create an order as a customer, then return here or open its private link on another device."}</p></section>}
  </div>;
}
