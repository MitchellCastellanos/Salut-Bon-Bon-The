import Link from "next/link";
import { notFound } from "next/navigation";
import { language, modifiers, money, pickupDate, stateLabels, transitions } from "../../../src/domain";
import { demoStaff, staffRole } from "../../../src/staff";
import { staffAuthConfigured } from "../../../src/auth";
import { listOrders } from "../../../src/orders";
import { Refresh } from "../../../src/refresh";
import { change, login, logout } from "./actions";

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
  const orders = await listOrders();
  return <div className="wrap section">
    <Refresh/>
    <div className="section-head"><div><p className="eyebrow">{role === "ADMIN" ? "ADMINISTRATION" : fr ? "ESPACE ÉQUIPE" : "STAFF AREA"}</p><h1>{fr ? "Commandes" : "Orders"}<span>.</span></h1></div><form action={logout.bind(null, lang)}><button className="outline">{fr ? "Déconnexion" : "Sign out"}</button></form></div>
    {role === "ADMIN" && <Link href={`/${lang}/admin`}>{fr ? "Prix et disponibilité" : "Pricing and availability"}</Link>}
    {!orders.length && <p>{fr ? "Aucune commande." : "No orders yet."}</p>}
    <div className="order-grid">{orders.map(order => <article className="panel" key={order.number.toString()}>
      <div className="section-head"><h2>#{order.number.toString()}</h2><strong className="pill">{stateLabels[order.status][lang]}</strong></div>
      <p><strong>{order.customer}</strong> · {pickupDate(new Date(order.pickup_at).toISOString(), lang)}</p>
      <small>{fr ? "Reçue" : "Received"} {pickupDate(new Date(order.created_at).toISOString(), lang)}</small>
      <ul>{order.items.map((item, i) => <li key={i}>{item.quantity} × {item.name[lang]} · {modifiers[item.size][lang]} · {"selectedModifiers" in item ? item.selectedModifiers.map(option => option[lang]).join(", ") || modifiers.none[lang] : modifiers[item.topping][lang]} · {fr ? "sucre" : "sugar"} {item.sugar}% · {fr ? "glace" : "ice"} {item.ice}%</li>)}</ul>
      {order.notes && <p>{order.notes}</p>}
      <p>{money(order.total, lang)} · {order.payment === "UNPAID" ? fr ? "À payer" : "Unpaid" : order.payment === "DEMO_PAID" ? fr ? "Paiement simulé" : "Simulated payment" : fr ? "Payée à la cueillette" : "Paid at pickup"}</p>
      <form action={change.bind(null, lang)} className="filters">
        <input type="hidden" name="number" value={order.number.toString()}/><input type="hidden" name="from" value={order.status}/>
        {order.status === "READY" && order.payment === "UNPAID" && <button name="to" value="PAY">{fr ? "Confirmer le paiement" : "Record payment"}</button>}
        {transitions[order.status].filter(state => state !== "COMPLETED" || order.payment !== "UNPAID").map(state => <button key={state} name="to" value={state}>→ {stateLabels[state][lang]}</button>)}
      </form>
    </article>)}</div>
  </div>;
}
