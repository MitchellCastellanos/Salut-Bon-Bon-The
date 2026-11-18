import Link from "next/link";
import { notFound } from "next/navigation";
import { language, modifiers, money, pickupDate, stateLabels, states, transitions } from "../../../src/domain";
import { demoStaff, staffRole } from "../../../src/staff";
import { staffAuthConfigured } from "../../../src/auth";
import { listOrders } from "../../../src/orders";
import { Refresh } from "../../../src/refresh";
import { change, login, logout } from "./actions";

const settledPayments = ["PAID_AT_PICKUP", "PAID_ONLINE", "DEMO_PAID"];
const paymentLabels: Record<string, Record<"fr" | "en", string>> = {
  UNPAID: { fr: "À payer", en: "Unpaid" }, PAID_AT_PICKUP: { fr: "Payée à la cueillette", en: "Paid at pickup" },
  DEMO_PAID: { fr: "Paiement simulé", en: "Simulated payment" }, PAID_ONLINE: { fr: "Payée en ligne", en: "Paid online" },
  PAYMENT_FAILED: { fr: "Paiement échoué", en: "Payment failed" }, REFUND_REQUIRED: { fr: "Remboursement requis", en: "Refund required" },
};

export const metadata = { robots: { index: false, follow: false } };
export default async function Staff({ params, searchParams }: PageProps<"/[lang]/staff">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const role = await staffRole();
  const demo = demoStaff();
  if (!role) return <div className="wrap section narrow">
    <h1>{fr ? "Espace équipe" : "Staff area"}<span>.</span></h1>
    <form className="panel checkout" action={login.bind(null, lang)}>
      {demo && <p>{fr ? "Mot de passe de démonstration" : "Demo password"} <code>salut-demo</code></p>}
      {(await searchParams).login && <p role="alert">{fr ? "Connexion refusée." : "Sign-in failed."}</p>}
      {!demo && !staffAuthConfigured() && <p role="status">{fr ? "Connexion de l’équipe indisponible." : "Staff sign-in is unavailable."}</p>}
      {!demo && <label>{fr ? "Courriel" : "Email"}<input type="email" name="email" required maxLength={254} autoComplete="username"/></label>}
      <label>{fr ? "Mot de passe" : "Password"}<input type="password" name="password" required maxLength={128} autoComplete="current-password"/></label>
      <button className="button" disabled={!demo && !staffAuthConfigured()}>{fr ? "Connexion" : "Sign in"}</button>
    </form>
  </div>;
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const status = typeof query.status === "string" && (states as readonly string[]).includes(query.status) ? query.status : "";
  const orders = await listOrders({ q, status });
  return <div className="wrap section">
    <Refresh/>
    <div className="section-head"><div><p className="eyebrow">{role === "ADMIN" ? "ADMINISTRATION" : fr ? "ESPACE ÉQUIPE" : "STAFF AREA"}</p><h1>{fr ? "Commandes" : "Orders"}<span>.</span></h1></div><form action={logout.bind(null, lang)}><button className="outline">{fr ? "Déconnexion" : "Sign out"}</button></form></div>
    {role === "ADMIN" && <Link href={`/${lang}/admin`}>{fr ? "Prix et disponibilité" : "Pricing and availability"}</Link>}
    <form method="get" className="filters" role="search" aria-label={fr ? "Filtrer les commandes" : "Filter orders"}>
      <label>{fr ? "Numéro ou nom" : "Number or name"}<input name="q" maxLength={80} defaultValue={q}/></label>
      <label>{fr ? "Statut" : "Status"}<select name="status" defaultValue={status}><option value="">{fr ? "Tous" : "All"}</option>{states.map(state => <option key={state} value={state}>{stateLabels[state][lang]}</option>)}</select></label>
      <button className="outline">{fr ? "Filtrer" : "Filter"}</button>
    </form>
    {!orders.length && <p>{fr ? "Aucune commande." : "No orders yet."}</p>}
    <div className="order-grid">{orders.map(order => <article className="panel" key={order.number.toString()}>
      <div className="section-head"><h2>#{order.number.toString()}</h2><strong className="pill">{stateLabels[order.status][lang]}</strong></div>
      <p><strong>{order.customer}</strong> · {pickupDate(new Date(order.pickup_at).toISOString(), lang)}</p>
      <small>{fr ? "Reçue" : "Received"} {pickupDate(new Date(order.created_at).toISOString(), lang)}</small>
      <ul>{order.items.map((item, i) => <li key={i}>{item.quantity} × {item.name[lang]} · {modifiers[item.size][lang]} · {"selectedModifiers" in item ? item.selectedModifiers.map(option => option[lang]).join(", ") || modifiers.none[lang] : modifiers[item.topping][lang]} · {fr ? "sucre" : "sugar"} {item.sugar}% · {fr ? "glace" : "ice"} {item.ice}%</li>)}</ul>
      {order.notes && <p>{order.notes}</p>}
      <p>{money(order.total, lang)}{order.tax_cents > 0 && <> ({fr ? "dont taxes" : "incl. tax"} {money(order.tax_cents, lang)})</>} · <strong>{paymentLabels[order.payment][lang]}</strong></p>
      <form action={change.bind(null, lang)} className="filters">
        <input type="hidden" name="number" value={order.number.toString()}/><input type="hidden" name="from" value={order.status}/>
        {order.status === "READY" && order.payment === "UNPAID" && <button name="to" value="PAY">{fr ? "Confirmer le paiement" : "Record payment"}</button>}
        {transitions[order.status].filter(state => (state !== "COMPLETED" || settledPayments.includes(order.payment)) && (state !== "CONFIRMED" || order.payment_method !== "card" || order.payment === "PAID_ONLINE")).map(state => <button key={state} name="to" value={state}>→ {stateLabels[state][lang]}</button>)}
      </form>
    </article>)}</div>
  </div>;
}
