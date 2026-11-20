import { notFound } from "next/navigation";
import { demoMode } from "../../../../src/demo-mode";
import { language } from "../../../../src/domain";
import { orderHref } from "../../../../src/order-links";

export const metadata = { title: "Salut Plus demo: customer and team", robots: { index: false, follow: false } };

/** The customer's phone on the left, the team's screen on the right: place an order and watch it arrive, then move it forward and watch the customer's page change. */
export default async function SideBySide({ params }: PageProps<"/[lang]/demo/side-by-side">) {
  const { lang } = await params;
  if (!language(lang) || !demoMode()) notFound();
  const fr = lang === "fr";
  const frame = { width: "100%", border: 0, background: "#fff" } as const;
  return <section className="wrap section">
    <p className="eyebrow">{fr ? "DÉMONSTRATION" : "DEMONSTRATION"}</p>
    <h1>{fr ? "Client et équipe, côte à côte" : "Customer and team, side by side"}<span>.</span></h1>
    <ol>
      <li>{fr ? "À gauche, le client choisit une boisson, la personnalise et paie (paiement simulé)." : "On the left, the customer picks a drink, customizes it and pays (simulated payment)."}</li>
      <li>{fr ? "À droite, connectez-vous à l’écran de l’équipe : la commande y apparaît toute seule." : "On the right, sign in to the team screen: the order shows up by itself."}</li>
      <li>{fr ? "Appuyez sur « Confirmed », « Preparing », « Ready » : la page de suivi du client avance en direct." : "Tap “Confirmed”, “Preparing”, “Ready”: the customer's tracking page moves forward live."}</li>
    </ol>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 20, alignItems: "start" }}>
      <div><h2>{fr ? "Le client (téléphone)" : "The customer (phone)"}</h2>
        <div style={{ border: "10px solid #3b2216", borderRadius: 28, overflow: "hidden", maxWidth: 420, margin: "0 auto" }}>
          <iframe title={fr ? "Écran du client" : "Customer screen"} src={orderHref(lang).replace("#orderable", "")} style={{ ...frame, height: 720 }}/></div></div>
      <div><h2>{fr ? "L’équipe (tablette)" : "The team (tablet)"}</h2>
        <div style={{ border: "10px solid #3b2216", borderRadius: 18, overflow: "hidden" }}>
          <iframe title={fr ? "Écran de l’équipe" : "Team screen"} src="/en/staff" style={{ ...frame, height: 720 }}/></div></div>
    </div>
  </section>;
}
