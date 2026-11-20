import { notFound } from "next/navigation";
import { language, pickupDate, stateLabels, states } from "../../../../src/domain";
import { trackOrder } from "../../../../src/orders";
import { CopyLink, Refresh } from "../../../../src/refresh";
import Link from "next/link";
import { getBusinessProfile } from "../../../../src/business";
import { PickupInstructions } from "../../../../src/business-view";

export const metadata = { robots: { index: false, follow: false } };
export default async function Tracking({ params }: PageProps<"/[lang]/track/[token]">) {
  const { lang, token } = await params;
  if (!language(lang)) notFound();
  const order = await trackOrder(token);
  const fr = lang === "fr";
  const profile = process.env.DATABASE_URL ? await getBusinessProfile().catch(() => null) : null;
  if (!order) return <div className="wrap section narrow"><h1>{fr ? "Commande introuvable" : "Order not found"}</h1></div>;
  return <div className="wrap section narrow">
    <Refresh />
    <p className="eyebrow">{fr ? "SUIVI PRIVÉ" : "PRIVATE TRACKING"}</p>
    <h1>{fr ? "Commande" : "Order"} #{order.number.toString()}</h1>
    <div className="panel"><p>{fr ? "Cueillette prévue" : "Scheduled pickup"} <strong>{pickupDate(new Date(order.pickup_at).toISOString(), lang)}</strong></p>
      <p role="status" className="pill">{stateLabels[order.status][lang]}</p>
      {order.status !== "CANCELLED" && <ol className="timeline">{states.slice(0, -1).map((status, index) => <li key={status} aria-current={status === order.status ? "step" : undefined} className={index <= states.indexOf(order.status) ? "passed" : ""}>{stateLabels[status][lang]}</li>)}</ol>}
      {profile && <PickupInstructions lang={lang} profile={profile}/>}
      {order.status === "COMPLETED" && <p className="fine-print">{fr ? "Si cette commande est liée à un compte ou à une carte Récompenses Salut, les tampons confirmés apparaissent dans l’historique de ce compte ou de cette carte (jamais sur ce lien)." : "If this order is linked to a Salut Rewards account or card, confirmed stamps appear in that account or card history (never on this link)."}</p>}
      <p><Link href={`/${lang}/track/${token}/receipt`}>{fr ? "Voir le reçu" : "View the receipt"}</Link></p>
      <p>{fr ? "Conserve ce lien pour suivre ta commande." : "Keep this link to follow your order."}</p><CopyLink lang={lang}/>
    </div>
  </div>;
}
