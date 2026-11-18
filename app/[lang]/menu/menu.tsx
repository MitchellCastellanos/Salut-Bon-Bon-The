"use client";
import Image from "next/image";
import { cartKey, cartChanged, officialCartKey } from "../../../src/cart";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { categories, lineSchema, modifiers, money, pickupDate, products, quote, type Lang, type Line } from "../../../src/domain";
import { salesTax } from "../../../src/pickup-policy";
import { pointsFor } from "../../../src/rewards-math";
import { PickupInstructions } from "../../../src/business-view";
import { selectionCost, type CatalogOptionGroup } from "../../../src/catalog-options";
import { selectedCampaign, trackInteraction } from "../analytics-client";
import { slots, submitOrder } from "./actions";

const errors: Record<string, [string, string]> = {
  PRICE: ["Le prix a changé. Vérifie le nouveau total avant de confirmer.", "The price changed. Review the new total before confirming."],
  RATE: ["Trop de commandes à la fois. Réessaie dans une minute.", "Too many checkout attempts. Try again in a minute."],
  SLOT: ["Choisis une nouvelle heure de cueillette.", "Choose a new pickup time."],
  MENU: ["Vérifie les options de ton panier.", "Check your cart options."],
  PAYMENT: ["Le paiement en ligne est indisponible. Choisis le paiement à la cueillette.", "Online payment is unavailable. Choose pay at pickup."],
  CONFLICT: ["Cette commande existe déjà avec d’autres détails.", "This order already exists with different details."],
};
type MenuProduct = {
  id: string;
  category: string;
  name: Record<Lang, string>;
  description?: Record<Lang, string>;
  topping: readonly Line["topping"][];
  prices: Partial<Record<Line["size"], number>>;
  groups?: CatalogOptionGroup[];
};

const demoProducts: MenuProduct[] = products.map(product => ({
  ...product,
  topping: product.topping as readonly Line["topping"][],
  prices: { regular: product.price, large: product.price + 100 },
}));

export type CartRewards = {
  pointsPerDollar: number; operational: boolean; allEligible: boolean; minOrderCents: number; linked: boolean; rewardsHref: string; cardHref: string; accountHref: string;
};
export function Menu({ lang, demo, photos, initialCategory, officialProducts, taxRates = [], cardPayments = false, logo, pickupInfo, rewards }: {
  rewards?: CartRewards;
  logo?: string;
  pickupInfo?: { displayName: string; street: string; city: string; province: string; postalCode: string; phone: string };
  lang: Lang;
  demo: boolean;
  cardPayments?: boolean;
  photos: Record<string, ReactNode>;
  initialCategory: keyof typeof categories | "all";
  officialProducts?: MenuProduct[];
  taxRates?: number[];
}) {
  const fr = lang === "fr";
  const official = officialProducts !== undefined;
  const listing = officialProducts ?? demoProducts;
  const storageKey = official ? officialCartKey : cartKey;
  const checkoutKey = official ? "salut-official-checkout" : "salut-checkout";
  const router = useRouter();
  const checkoutStarted = useRef(false);
  const customization = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<"all" | keyof typeof categories>(initialCategory);
  const [selected, setSelected] = useState<MenuProduct>();
  const [cart, setCart] = useState<Line[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectionError, setSelectionError] = useState("");
  useEffect(() => {
    const init = window.setTimeout(() => {
      try {
        const saved = lineSchema.array().max(20).parse(JSON.parse(localStorage.getItem(storageKey) || "[]"));
        setCart(saved.filter(line => (official || !line.optionIds?.length) && listing.some(product => product.id === line.product && product.prices[line.size] !== undefined && product.topping.includes(line.topping))));
      } catch { /* An invalid or unavailable cart starts empty. */ }
      setReady(true);
    }, 0);
    slots().then(setTimes).catch(() => setError(fr ? "Heures indisponibles." : "Pickup times unavailable."));
    return () => window.clearTimeout(init);
  }, [fr, listing, official, storageKey]);
  useEffect(() => {
    if (selected) customization.current?.querySelector("select")?.focus();
  }, [selected]);
  function save(lines: Line[]) {
    setCart(lines);
    try { localStorage.setItem(storageKey, JSON.stringify(lines)); window.dispatchEvent(new Event(cartChanged)); } catch { /* Keep the current cart usable. */ }
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !ready || cart.length >= 20) return;
    const form = new FormData(event.currentTarget);
    const optionIds = official ? form.getAll("option").map(String) : undefined;
    try {
      selectionCost(selected.groups ?? [], optionIds ?? []);
    } catch {
      setSelectionError(fr ? "Vérifie le nombre d’options sélectionnées." : "Check the number of selected options.");
      return;
    }
    const line = lineSchema.parse({ ...Object.fromEntries(form), product: selected.id, quantity: Number(form.get("quantity")), ...(official ? { optionIds } : {}) });
    save([...cart, line]);
    if (official) trackInteraction("add_to_cart");
    setMessage(fr ? "Boisson ajoutée au panier." : "Drink added to cart.");
    setSelected(undefined);
    setSelectionError("");
  }
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...form, lang, lines: priced.map(item => cart[item.index]), ...(official ? { expectedTotal: total } : {}) };
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
      let request = crypto.randomUUID();
      try {
        const pending = JSON.parse(sessionStorage.getItem(checkoutKey) || "null");
        if (pending?.fingerprint === fingerprint) request = pending.request;
        sessionStorage.setItem(checkoutKey, JSON.stringify({ request, fingerprint }));
      } catch { /* The order remains usable when storage is unavailable. */ }
      const result = await submitOrder({ ...payload, request }, official ? selectedCampaign() : undefined);
      if (result.token) {
        save([]);
        try { sessionStorage.removeItem(checkoutKey); } catch { /* Storage can be disabled. */ }
        if (result.redirect) window.location.assign(result.redirect);
        else router.push(`/${lang}/track/${result.token}`);
        return;
      }
      const localized = errors[result.error ?? "FAILED"];
      setError(localized ? localized[fr ? 0 : 1] : fr ? "Commande indisponible. Réessaie." : "Could not place the order. Try again.");
      if (result.error === "PRICE" || (official && result.error === "MENU")) router.refresh();
      if (result.error === "SLOT") setTimes(await slots());
    } catch {
      setError(fr ? "Connexion interrompue. Réessaie." : "Connection interrupted. Try again.");
    } finally { setBusy(false); }
  }
  const priced = official ? cart.flatMap((line, index) => {
    const product = listing.find(item => item.id === line.product);
    const price = product?.prices[line.size];
    if (!product || price === undefined) return [];
    try {
      const { selected, cents } = selectionCost(product.groups ?? [], line.optionIds ?? []);
      return [{ ...line, name: product.name, subtotal: (price + cents) * line.quantity, index, chosen: selected }];
    } catch {
      return [];
    }
  }) : quote(cart).map((line, index) => ({ ...line, index, chosen: [] }));
  const subtotal = priced.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = official ? salesTax(subtotal, taxRates) : 0;
  const total = subtotal + tax;
  return <div className="menu-layout">
    <div>
      {!official && <div className="filters">{(["all", "fruit", "milk", "matcha"] as const).map(id => <button type="button" key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>{id === "all" ? fr ? "Tout" : "All" : categories[id][lang]}</button>)}</div>}
      <div className="product-grid menu-grid">{listing.filter(p => category === "all" || category === p.category).map(p => <article className="product-card" id={official ? `order-${p.id}` : p.id} key={p.id}>
        {photos[p.id]}<div><strong>{p.name[lang]}</strong><span>{money(p.prices.regular ?? p.prices.large ?? 0, lang)}</span></div>{p.description && <p>{p.description[lang]}</p>}
        <button className="outline" onClick={() => { setSelectionError(""); setSelected(p); }}>{fr ? "Personnaliser" : "Customize"} ＋</button>
      </article>)}</div>
      {selected && <form ref={customization} className="panel customize" key={selected.id} onSubmit={add}><h2>{selected.name[lang]}</h2>
        <div className="fields">
          <label>{fr ? "Format" : "Size"}<select name="size">{(["regular", "large"] as const).filter(s => selected.prices[s] !== undefined).map(s => <option key={s} value={s}>{modifiers[s][lang]}{official ? ` · ${money(selected.prices[s]!, lang)}` : s === "large" ? ` +${money(100, lang)}` : ""}</option>)}</select></label>
          <label>{fr ? "Sucre" : "Sugar"}<select name="sugar" defaultValue="100">{["0", "50", "100"].map(s => <option key={s} value={s}>{s}%</option>)}</select></label>
          <label>{fr ? "Glace" : "Ice"}<select name="ice" defaultValue="100">{["0", "50", "100"].map(s => <option key={s} value={s}>{s}%</option>)}</select></label>
          {official ? <input type="hidden" name="topping" value="none"/> : <label>{fr ? "Garniture" : "Topping"}<select name="topping">{selected.topping.map(s => <option key={s} value={s}>{modifiers[s][lang]}{s !== "none" ? ` +${money(75, lang)}` : ""}</option>)}</select></label>}
          <label>{fr ? "Quantité" : "Quantity"}<input name="quantity" type="number" min={1} max={10} defaultValue={1} required/></label>
        </div>
        {selected.groups?.filter(group => group.options.length > 0).map(group => <fieldset key={group.id}>
          <legend>{({ tapioca: "Tapioca", "brown-sugar": fr ? "Boba à la cassonade" : "Brown Sugar Boba", popping: fr ? "Perles éclatantes" : "Popping pearls", jelly: fr ? "Gelées" : "Jellies" } as Record<string, string>)[group.id]} · {group.min}–{group.max}</legend>
          {group.options.map(option => <label key={option.id}><input type="checkbox" name="option" value={option.id} defaultChecked={option.default}/> {option[lang]}{option.cents > 0 ? ` +${money(option.cents, lang)}` : ""}</label>)}
        </fieldset>)}
        {selectionError && <p role="alert">{selectionError}</p>}
        <button className="button" disabled={!ready || cart.length >= 20}>{fr ? "Ajouter au panier" : "Add to cart"}</button>{" "}
        <button className="outline" type="button" onClick={() => setSelected(undefined)}>{fr ? "Fermer" : "Close"}</button>
      </form>}
      <p role="status">{message}</p>
    </div>
    <aside className="panel cart" id="cart"><p className="checkout-brand" aria-hidden="true">{logo ? <Image src={logo} alt="" width={90} height={42} unoptimized/> : "Salut Bon Bon Thé"}</p><h2>{fr ? "Ton panier" : "Your cart"}</h2>
      {!priced.length ? <p>{fr ? "Ton panier est vide." : "Your cart is empty."}</p> : <>
        <ul className="cart-lines">{priced.map(item => <li key={item.index}><div><strong>{item.quantity} × {item.name[lang]}</strong><small>{modifiers[item.size][lang]} · {item.chosen.length ? item.chosen.map(option => option[lang]).join(", ") : modifiers[item.topping][lang]} · {fr ? "sucre" : "sugar"} {item.sugar}% · {fr ? "glace" : "ice"} {item.ice}%</small></div><div className="qty" role="group" aria-label={fr ? `Quantité de ${item.name[lang]}` : `Quantity of ${item.name[lang]}`}>
            <button type="button" className="outline" aria-label={fr ? `Diminuer la quantité de ${item.name[lang]}` : `Decrease quantity of ${item.name[lang]}`} disabled={item.quantity <= 1} onClick={() => save(cart.map((line, i) => i === item.index ? { ...line, quantity: Math.max(1, line.quantity - 1) } : line))}>−</button>
            <output aria-live="polite">{item.quantity}</output>
            <button type="button" className="outline" aria-label={fr ? `Augmenter la quantité de ${item.name[lang]}` : `Increase quantity of ${item.name[lang]}`} disabled={item.quantity >= 10} onClick={() => save(cart.map((line, i) => i === item.index ? { ...line, quantity: Math.min(10, line.quantity + 1) } : line))}>+</button>
          </div><div>{money(item.subtotal, lang)} <button type="button" className="remove" aria-label={fr ? `Retirer ${item.name[lang]}` : `Remove ${item.name[lang]}`} onClick={() => save(cart.filter((_, i) => item.index !== i))}>×</button></div></li>)}</ul>
        {official && <p>{fr ? "Taxes" : "Sales tax"} · {money(tax, lang)}</p>}
        <p className="total">{official ? "Total" : fr ? "Total démo" : "Demo total"} <strong>{money(total, lang)}</strong></p>
        {official && rewards && (() => {
          // Estimate on the pre-tax subtotal only (never tax). Confirmed points exist only once the order is completed.
          const estimate = rewards.allEligible && subtotal >= rewards.minOrderCents ? pointsFor(subtotal, rewards.pointsPerDollar) : null;
          return <p className="fine-print" data-testid="points-estimate" role="note">{!rewards.operational ?
            (fr ? `Aperçu Récompenses Salut : ${estimate === null ? "les points dépendent des produits admissibles" : `environ ${estimate} points`}, mais le programme n’est pas encore actif : aucun point ne sera crédité.` : `Salut Rewards preview: ${estimate === null ? "points depend on eligible products" : `about ${estimate} points`}, but the program is not active yet: no points will be credited.`) :
            rewards.linked ? (fr ? `Estimation : ${estimate === null ? "points selon les produits admissibles" : `environ ${estimate} points`} (avant taxes). Ils seront confirmés une fois la commande terminée.` : `Estimate: ${estimate === null ? "points based on eligible products" : `about ${estimate} points`} (before tax). They are confirmed once the order is completed.`) :
            <>{fr ? "Cette commande ne cumulera pas de points sans compte ni carte. " : "This order will not earn points without an account or card. "}<a href={rewards.accountHref}>{fr ? "Se connecter" : "Sign in"}</a> · <a href={rewards.cardHref}>{fr ? "Obtenir une carte invité" : "Get a guest card"}</a></>}
            {" "}<a href={rewards.rewardsHref}>{fr ? "En savoir plus" : "Learn more"}</a></p>;
        })()}
        <form className="checkout" onSubmit={checkout} onFocus={() => {
          if (official && !checkoutStarted.current) {
            checkoutStarted.current = true;
            trackInteraction("checkout_start");
          }
        }}>
          {pickupInfo && <PickupInstructions lang={lang} profile={pickupInfo}/>}
          <label>{fr ? "Nom pour la cueillette" : "Pickup name"}<input name="name" required maxLength={80} autoComplete="given-name"/></label>
          <label>{fr ? "Heure de cueillette" : "Pickup time"}<select required name="pickup" defaultValue=""><option value="" disabled>{fr ? "Choisir une heure" : "Choose a time"}</option>{times.map(time => <option key={time} value={time}>{pickupDate(time, lang)}</option>)}</select></label>
          <label>{fr ? "Courriel (facultatif)" : "Email (optional)"}<input name="email" type="email" maxLength={254} autoComplete="email" aria-describedby="email-note"/></label>
          <p id="email-note" className="fine-print">{fr ? "Utilisé seulement pour les messages sur cette commande. Aucune infolettre." : "Used only for messages about this order. No newsletter."}</p>
          <label>{fr ? "Note facultative" : "Optional note"}<input name="notes" maxLength={240}/></label>
          <label>{fr ? "Paiement" : "Payment"}<select name="method"><option value="pickup">{fr ? "Payer à la cueillette" : "Pay at pickup"}</option>{cardPayments && <option value="card">{fr ? "Carte de crédit (en ligne)" : "Credit card (online)"}</option>}{demo && <option value="demo">{fr ? "Paiement simulé · aucun débit" : "Simulated payment · no charge"}</option>}</select></label>
          <button className="button" disabled={busy || !times.length}>{busy ? fr ? "Envoi…" : "Sending…" : fr ? "Passer la commande" : "Place order"}</button>
        </form>
      </>}
      {error && <p role="alert">{error}</p>}
    </aside>
  </div>;
}
