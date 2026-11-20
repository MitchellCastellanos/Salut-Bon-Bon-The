import { notFound } from "next/navigation";
import { language, money } from "../../../../src/domain";
import { simulatedAttempt } from "../../../../src/payments";
import { simulatedPayments } from "../../../../src/providers/stripe";
import { finishSimulatedPayment } from "./actions";

export const metadata = { title: "Payment", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function SimulatedPayment({ params }: PageProps<"/[lang]/pay/[session]">) {
  const { lang, session } = await params;
  if (!language(lang) || !simulatedPayments()) notFound();
  const attempt = await simulatedAttempt(session);
  if (!attempt) notFound();
  const fr = lang === "fr";
  const open = attempt.status === "CREATED";
  const subtotal = attempt.items.reduce((sum, item) => sum + item.subtotal, 0);
  return <section className="wrap section narrow">
    <p className="eyebrow">{fr ? "PAIEMENT SIMULÉ · AUCUN MONTANT N’EST DÉBITÉ" : "SIMULATED PAYMENT · NOTHING IS CHARGED"}</p>
    <h1>{fr ? "Paiement" : "Payment"}<span>.</span></h1>
    <p className="panel" role="note">{fr
      ? "Cette page remplace Stripe Checkout pendant la démonstration. En production, le client verra la page de paiement sécurisée de Stripe au même endroit du parcours."
      : "This page stands in for Stripe Checkout during the demonstration. In production the customer sees Stripe's secure payment page at this same step."}</p>
    <div className="panel">
      <h2>{fr ? "Commande" : "Order"} #{attempt.order_number}</h2>
      <ul>{attempt.items.map((item, i) => <li key={i}>{item.quantity} × {item.name[lang]} · {money(item.subtotal, lang)}</li>)}</ul>
      {attempt.tax_cents > 0 && <p>{fr ? "Taxes" : "Taxes"}: {money(attempt.tax_cents, lang)}{" "}<small>({fr ? "sous-total" : "subtotal"} {money(subtotal, lang)})</small></p>}
      <p><strong>{fr ? "Total" : "Total"}: {money(attempt.amount_cents, lang)} CAD</strong></p>
    </div>
    {open ? <form className="panel checkout" action={finishSimulatedPayment.bind(null, lang, session)}>
      <label>{fr ? "Numéro de carte (test)" : "Card number (test)"}<input value="4242 4242 4242 4242" readOnly aria-readonly="true"/></label>
      <div className="fields"><label>{fr ? "Expiration" : "Expiry"}<input value="12 / 34" readOnly aria-readonly="true"/></label><label>CVC<input value="123" readOnly aria-readonly="true"/></label></div>
      <button className="button" name="result" value="pay">{fr ? `Payer ${money(attempt.amount_cents, lang)} (simulation)` : `Pay ${money(attempt.amount_cents, lang)} (simulation)`}</button>
      <button name="result" value="fail" className="outline">{fr ? "Annuler le paiement" : "Cancel payment"}</button>
    </form> : <p className="panel" role="status">{fr ? "Ce paiement est déjà traité." : "This payment has already been processed."}</p>}
  </section>;
}
