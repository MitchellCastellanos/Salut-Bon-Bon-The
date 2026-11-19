"use client";

import { useMemo, useState } from "react";

type Option = { id: string; label: string; cents: number; default: boolean };
type Group = { id: string; min: number; max: number; options: Option[] };
export type CounterProduct = { id: string; name: string; prices: { regular?: number; large?: number }; groups: Group[] };
type Line = { product: string; size: "regular" | "large"; quantity: number; optionIds: string[] };

const money = (cents: number) => (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

export function CounterForm({ lang, products, request, action }: { lang: "fr" | "en"; products: CounterProduct[]; request: string; action: (form: FormData) => void | Promise<void> }) {
  const fr = lang === "fr";
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picked, setPicked] = useState<CounterProduct | null>(null);
  const [size, setSize] = useState<"regular" | "large">("regular");
  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState<string[]>([]);
  const normalize = (value: string) => value.toLocaleLowerCase(lang).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const matches = useMemo(() => products.filter(product => normalize(product.name).includes(normalize(query))).slice(0, 12), [products, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const find = (id: string) => products.find(product => product.id === id)!;
  const cost = (line: Line) => {
    const product = find(line.product);
    const extra = product.groups.flatMap(group => group.options).filter(option => line.optionIds.includes(option.id)).reduce((sum, option) => sum + option.cents, 0);
    return ((product.prices[line.size] ?? 0) + extra) * line.quantity;
  };
  const subtotal = lines.reduce((sum, line) => sum + cost(line), 0);
  const choose = (product: CounterProduct) => {
    setPicked(product); setSize(product.prices.regular ? "regular" : "large"); setQty(1);
    setChosen(product.groups.flatMap(group => group.options.filter(option => option.default).map(option => option.id)));
  };
  const toggle = (group: Group, option: Option) => setChosen(current => {
    const inGroup = current.filter(id => group.options.some(item => item.id === id));
    if (current.includes(option.id)) return current.filter(id => id !== option.id);
    if (group.max === 1) return [...current.filter(id => !inGroup.includes(id)), option.id];
    return inGroup.length >= group.max ? current : [...current, option.id];
  });
  const valid = picked !== null && picked.groups.every(group => {
    const count = chosen.filter(id => group.options.some(option => option.id === id)).length;
    return count >= group.min && count <= group.max;
  });
  const add = () => {
    if (!picked || !valid) return;
    setLines(current => [...current, { product: picked.id, size, quantity: qty, optionIds: chosen }]);
    setPicked(null); setQuery("");
  };
  return <form action={action} className="checkout">
    <input type="hidden" name="request" value={request}/>
    <input type="hidden" name="lines" value={JSON.stringify(lines)}/>
    <section className="panel" aria-labelledby="pick-title">
      <h2 id="pick-title">{fr ? "Ajouter une boisson" : "Add a drink"}</h2>
      <label>{fr ? "Rechercher" : "Search"}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPicked(null); }} maxLength={100} autoComplete="off"/></label>
      {!picked && query && <ul className="catalog-links">{matches.map(product => <li key={product.id}><button type="button" className="outline" onClick={() => choose(product)}>{product.name}</button></li>)}</ul>}
      {picked && <div>
        <h3>{picked.name}</h3>
        <label>{fr ? "Format" : "Size"}<select value={size} onChange={event => setSize(event.target.value as "regular" | "large")}>
          {picked.prices.regular && <option value="regular">{fr ? "Régulier" : "Regular"} · {money(picked.prices.regular)}</option>}
          {picked.prices.large && <option value="large">{fr ? "Grand" : "Large"} · {money(picked.prices.large)}</option>}
        </select></label>
        {picked.groups.map(group => <fieldset key={group.id}><legend>{group.id}{group.min ? ` (${fr ? "requis" : "required"})` : ""}</legend>
          {group.options.map(option => <label key={option.id}><input type={group.max === 1 ? "radio" : "checkbox"} name={`g-${group.id}`} checked={chosen.includes(option.id)} onChange={() => toggle(group, option)}/> {option.label}{option.cents ? ` (+${money(option.cents)})` : ""}</label>)}
        </fieldset>)}
        <label>{fr ? "Quantité" : "Quantity"}<input type="number" min={1} max={20} value={qty} onChange={event => setQty(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}/></label>
        <button type="button" className="button" disabled={!valid} onClick={add}>{fr ? "Ajouter à la commande" : "Add to the order"}</button>
      </div>}
    </section>
    <section className="panel" aria-labelledby="ticket-title">
      <h2 id="ticket-title">{fr ? "Commande" : "Order"}</h2>
      {!lines.length ? <p>{fr ? "Aucune boisson ajoutée." : "No drinks added."}</p> : <ul>
        {lines.map((line, index) => <li key={index}>{line.quantity} × {find(line.product).name} · {line.size === "large" ? (fr ? "Grand" : "Large") : (fr ? "Régulier" : "Regular")} · {money(cost(line))}{" "}
          <button type="button" className="outline" onClick={() => setLines(current => current.filter((_, i) => i !== index))} aria-label={fr ? "Retirer" : "Remove"}>×</button></li>)}
      </ul>}
      <p className="total">{fr ? "Sous-total (avant taxes)" : "Subtotal (before tax)"} <strong>{money(subtotal)}</strong></p>
      <label>{fr ? "Nom (facultatif)" : "Name (optional)"}<input name="name" maxLength={80} autoComplete="off"/></label>
      <label>{fr ? "Client Récompenses : code ou courriel (facultatif)" : "Rewards customer: code or email (optional)"}<input name="member" maxLength={254} autoComplete="off"/></label>
      <label>{fr ? "Mode de paiement" : "Payment method"}<select name="tender" defaultValue="terminal">
        <option value="terminal">{fr ? "Terminal (carte)" : "Terminal (card)"}</option><option value="cash">{fr ? "Comptant" : "Cash"}</option><option value="other">{fr ? "Autre" : "Other"}</option></select></label>
      <button className="button" disabled={!lines.length}>{fr ? "Enregistrer la vente (payée)" : "Record the sale (paid)"}</button>
    </section>
  </form>;
}
