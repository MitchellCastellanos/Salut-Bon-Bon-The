"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Lang = "fr" | "en";
type Order = { id: string; name: string; drink: string; size: string; topping: string; quantity: number; subtotal: number; total: number; points: number; status: number; pickup: string; createdAt: string };
const drinks = [
  { id: "mango", fr: "Thé mangue", en: "Mango tea", regular: 575 },
  { id: "classic", fr: "Thé au lait classique", en: "Classic milk tea", regular: 595 },
  { id: "matcha", fr: "Matcha au lait", en: "Matcha milk tea", regular: 675 },
  { id: "smoothie", fr: "Smoothie aux fruits", en: "Fruit smoothie", regular: 650 },
  { id: "brulee", fr: "Crème brûlée", en: "Crème brûlée", regular: 750 },
] as const;
const statuses = { fr: ["Reçue", "Confirmée", "En préparation", "Prête", "Remise"], en: ["Received", "Confirmed", "Preparing", "Ready", "Completed"] };
const key = "salut-isolated-demo-order-v1";
const currency = (n: number, lang: Lang) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(n / 100);
export function OrderRewardsDemo({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const [product, setProduct] = useState<string>("mango");
  const [size, setSize] = useState("regular");
  const [topping, setTopping] = useState("none");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [pickup, setPickup] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [view, setView] = useState<"customer" | "staff">("customer");
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setOrder(JSON.parse(raw)); } catch { /* Demo remains usable when storage is blocked. */ } }, []);
  const drink = drinks.find(d => d.id === product) ?? drinks[0];
  const unit = drink.regular + (size === "large" ? 100 : 0) + (topping === "none" ? 0 : 75);
  const subtotal = unit * quantity;
  const gst = Math.round(subtotal * 0.05);
  const qst = Math.round(subtotal * 0.09975);
  const total = subtotal + gst + qst;
  const points = Math.floor(subtotal / 100) * 10;
  const save = (value: Order | null) => { setOrder(value); try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch { /* No server writes. */ } };
  const place = () => {
    if (!name.trim() || !pickup) return;
    const id = "DEMO-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    save({ id, name: name.trim().slice(0, 80), drink: fr ? drink.fr : drink.en, size, topping, quantity, subtotal, total, points, status: 0, pickup, createdAt: new Date().toISOString() });
  };
  return <main className="wrap section" style={{ maxWidth: 960 }}>
    <p className="eyebrow">{fr ? "Démonstration interactive" : "Interactive demonstration"}</p>
    <h1>{fr ? "Essayez une commande" : "Try an order"}<span>.</span></h1>
    <p role="note" className="panel" style={{ borderLeft: "4px solid #c17b4a" }}><strong>{fr ? "MODE DÉMO — AUCUN ACHAT RÉEL" : "DEMO MODE — NO REAL PURCHASE"}</strong><br/>{fr ? "Prix, taxes, horaires et points fictifs. Aucune commande n'est envoyée à la boutique, aucun paiement ni point de fidélité réel n'est créé. Les données restent dans ce navigateur." : "Sample prices, taxes, times and points. Nothing is sent to the store; no payment or real loyalty points are created. Data stays in this browser."}</p>
    <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
      <button type="button" className={view === "customer" ? "button" : "outline"} onClick={() => setView("customer")}>{fr ? "Vue client" : "Customer view"}</button>
      <button type="button" className={view === "staff" ? "button" : "outline"} onClick={() => setView("staff")}>{fr ? "Vue équipe (simulation)" : "Staff view (simulation)"}</button>
      <Link className="outline" href={fr ? "/fr/recompenses" : "/en/rewards"}>{fr ? "Voir les récompenses" : "See rewards"}</Link>
    </nav>
    {view === "customer" && !order && <section className="panel" style={{ display: "grid", gap: 16 }}>
      <h2>{fr ? "Personnalisez votre boisson" : "Customize your drink"}</h2>
      <label>{fr ? "Boisson" : "Drink"}<select value={product} onChange={e => setProduct(e.target.value)}>{drinks.map(d => <option key={d.id} value={d.id}>{fr ? d.fr : d.en}</option>)}</select></label>
      <label>{fr ? "Format" : "Size"}<select value={size} onChange={e => setSize(e.target.value)}><option value="regular">{fr ? "Régulier" : "Regular"}</option><option value="large">{fr ? "Grand (+1,00 $)" : "Large (+$1.00)"}</option></select></label>
      <label>{fr ? "Garniture" : "Topping"}<select value={topping} onChange={e => setTopping(e.target.value)}><option value="none">{fr ? "Aucune" : "None"}</option><option value="pearls">{fr ? "Perles de tapioca (+0,75 $)" : "Tapioca pearls (+$0.75)"}</option><option value="popping">{fr ? "Perles éclatantes (+0,75 $)" : "Popping pearls (+$0.75)"}</option></select></label>
      <label>{fr ? "Quantité" : "Quantity"}<input type="number" min="1" max="10" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}/></label>
      <h2>{fr ? "Résumé" : "Summary"}</h2>
      <p>{fr ? "Sous-total" : "Subtotal"}: {currency(subtotal, lang)} · TPS/GST: {currency(gst, lang)} · TVQ/QST: {currency(qst, lang)}</p>
      <p><strong>{fr ? "Total fictif" : "Sample total"}: {currency(total, lang)}</strong></p>
      <p>🎁 {fr ? "Points potentiels (non crédités)" : "Potential points (not credited)"}: <strong>{points}</strong> · {fr ? "Valeur indicative" : "Indicative value"}: {currency(Math.floor(points * 0.5), lang)} ({fr ? "1 000 points = 5 $" : "1,000 points = $5"})</p>
      <label>{fr ? "Nom pour la cueillette" : "Pickup name"}<input required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={fr ? "Votre nom" : "Your name"}/></label>
      <label>{fr ? "Heure fictive de cueillette" : "Sample pickup time"}<select required value={pickup} onChange={e => setPickup(e.target.value)}><option value="">{fr ? "Choisir un créneau" : "Choose a time"}</option><option value="14:00">14:00</option><option value="14:30">14:30</option><option value="15:00">15:00</option><option value="15:30">15:30</option></select></label>
      <button type="button" className="button" disabled={!name.trim() || !pickup} onClick={place}>{fr ? "Confirmer la commande fictive" : "Confirm sample order"}</button>
    </section>}
    {view === "customer" && order && <section className="panel" aria-live="polite">
      <p className="eyebrow">{order.id}</p><h2>{fr ? "Suivi de votre commande fictive" : "Track your sample order"}</h2>
      <p>{order.quantity} × {order.drink} · {currency(order.total, lang)} · {order.pickup}</p>
      <p><strong>{statuses[lang][order.status]}</strong></p>
      <ol>{statuses[lang].map((s, i) => <li key={s} style={{ opacity: i <= order.status ? 1 : 0.45 }}>{i <= order.status ? "✓ " : "○ "}{s}</li>)}</ol>
      <p>🎁 {order.points} {fr ? "points simulés — jamais crédités" : "simulated points — never credited"}</p>
      <button type="button" className="outline" onClick={() => { if (confirm(fr ? "Effacer cette simulation ?" : "Clear this simulation?")) save(null); }}>{fr ? "Nouvelle simulation" : "New simulation"}</button>
    </section>}
    {view === "staff" && <section className="panel">
      <h2>{fr ? "Tableau de préparation — simulation" : "Preparation board — simulation"}</h2>
      {!order ? <p>{fr ? "Aucune commande fictive dans ce navigateur." : "No sample order in this browser."}</p> : <>
        <p><strong>{order.id}</strong> · {order.name} · {order.quantity} × {order.drink} · {order.pickup}</p>
        <p>{fr ? "État" : "Status"}: <strong>{statuses[lang][order.status]}</strong></p>
        <button type="button" className="button" disabled={order.status >= 4} onClick={() => save({ ...order, status: Math.min(4, order.status + 1) })}>{fr ? "Passer à l'étape suivante" : "Advance order status"}</button>
      </>}
      <p className="fine-print">{fr ? "Ce tableau n'est pas le véritable accès STAFF. Il ne lit ni ne modifie les commandes de la boutique." : "This is not the real STAFF dashboard. It never reads or changes store orders."}</p>
    </section>}
  </main>;
}
