import Link from "next/link";
import { notFound } from "next/navigation";
import { demoMode } from "../../../src/demo-mode";
import { language } from "../../../src/domain";
import { simulatedPayments } from "../../../src/providers/stripe";
import { pickupConfiguration } from "../../../src/store-settings";
import { staffRole } from "../../../src/staff";
import { orderHref } from "../../../src/order-links";
import { rewardsPath } from "../../../src/rewards-paths";

export const metadata = { title: "Salut Plus demo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Guided tour of the whole Salut Plus journey: where the customer orders, where the team receives and prepares the order, and the owner's admin. */
export default async function DemoGuide({ params }: PageProps<"/[lang]/demo">) {
  const { lang } = await params;
  if (!language(lang) || !demoMode()) notFound();
  const fr = lang === "fr";
  const [{ blockers }, role] = await Promise.all([pickupConfiguration().catch(() => ({ blockers: ["NO_SCHEDULE"] as string[] })), staffRole().catch(() => undefined)]);
  const steps: { who: [string, string]; title: [string, string]; text: [string, string]; href: string; action: [string, string] }[] = [
    { who: ["Client", "Customer"], title: ["Créer un compte et commander", "Create an account and order"],
      text: ["Le client crée son compte, choisit une boisson, la personnalise (format, garnitures), l’ajoute au panier et choisit l’heure de cueillette.", "The customer creates an account, picks a drink, customizes it (size, toppings), adds it to the cart and chooses a pickup time."],
      href: `/${lang}/account`, action: ["Créer un compte", "Create an account"] },
    { who: ["Client", "Customer"], title: ["Payer en ligne", "Pay online"],
      text: [simulatedPayments() ? "Le paiement utilise la page simulée : aucun montant n’est débité. En production, c’est la page sécurisée de Stripe, au même endroit du parcours." : "Le paiement passe par la page sécurisée de Stripe (mode test).", simulatedPayments() ? "Payment uses the simulated page: nothing is charged. In production this is Stripe's secure page, at the same step." : "Payment goes through Stripe's secure page (test mode)."],
      href: orderHref(lang), action: ["Commander", "Order now"] },
    { who: ["Équipe", "Team"], title: ["Recevoir la commande", "Receive the order"],
      text: ["La commande apparaît toute seule dans l’écran de l’équipe (rafraîchi aux 5 secondes) avec le nom, l’heure de cueillette et chaque boisson personnalisée.", "The order appears by itself on the team screen (refreshed every 5 seconds) with the name, pickup time and every customized drink."],
      href: `/en/staff`, action: ["Ouvrir l’écran de l’équipe", "Open the team screen"] },
    { who: ["Équipe", "Team"], title: ["Préparer et marquer « prête »", "Prepare and mark “ready”"],
      text: ["L’équipe confirme, prépare, puis appuie sur « Ready ». La page de suivi du client avance en direct. Une fois la commande remise, elle la marque « Completed ».", "The team confirms, prepares, then taps “Ready”. The customer's tracking page moves forward live. When handed over, the team marks it “Completed”."],
      href: `/en/staff`, action: ["Voir la file de commandes", "See the order queue"] },
    { who: ["Client", "Customer"], title: ["Suivre sa commande et cumuler des tampons", "Follow the order and collect stamps"],
      text: ["Le client voit le statut en direct, retrouve ses commandes dans « Mes commandes » et reçoit un tampon par boisson une fois la commande terminée (9 tampons, la 10e est gratuite).", "The customer sees the live status, finds orders under “My orders” and gets one stamp per drink once the order is completed (9 stamps, the 10th is free)."],
      href: `/${lang}/account/rewards`, action: ["Ma carte Récompenses", "My Rewards card"] },
    { who: ["Client", "Customer"], title: ["Carte numérique, QR et Apple Wallet", "Digital card, QR and Apple Wallet"],
      text: ["La carte affiche un code QR avec le logo officiel. Il ne contient aucun renseignement personnel et peut être remplacé en tout temps. Le bouton Apple Wallet s’active dès que les identifiants Apple sont branchés.", "The card shows a QR code with the official logo. It holds no personal information and can be replaced at any time. The Apple Wallet button turns on as soon as Apple credentials are connected."],
      href: `/${lang}/account/rewards`, action: ["Voir la carte", "See the card"] },
    { who: ["Équipe", "Team"], title: ["Scanner la carte et offrir la boisson gratuite", "Scan the card and give the free drink"],
      text: ["Au comptoir, l’équipe scanne la carte (caméra, lecteur ou saisie), ajoute des tampons pour un achat en magasin, ou confirme l’échange de la boisson gratuite.", "At the counter the team scans the card (camera, scanner or typing), adds stamps for an in-store purchase, or confirms the free-drink redemption."],
      href: `/en/staff/rewards`, action: ["Ouvrir le scanner", "Open the scanner"] },
    { who: ["Propriétaire", "Owner"], title: ["Tout gérer depuis l’administration", "Manage everything from the admin"],
      text: ["Menu et prix, heures et capacité, taxes, clients et tampons, règles de Récompenses, équipe, remboursements, journal des courriels et historique des modifications : sans développeur.", "Menu and prices, hours and capacity, taxes, customers and stamps, rewards rules, team, refunds, the email log and the change history: no developer needed."],
      href: `/en/admin`, action: ["Ouvrir l’administration", "Open the admin"] },
  ];
  return <section className="wrap section">
    <p className="eyebrow">{fr ? "DÉMONSTRATION SALUT PLUS" : "SALUT PLUS DEMONSTRATION"}</p>
    <h1>{fr ? "Le parcours complet" : "The complete journey"}<span>.</span></h1>
    <p className="intro">{fr
      ? "Ceci est une boutique de test qui fonctionne vraiment : les commandes passées ici arrivent sur l’écran de l’équipe et dans l’administration. Aucun paiement réel n’est effectué et aucun courriel n’est envoyé."
      : "This is a working test store: orders placed here really arrive on the team screen and in the admin. No real payment is taken and no email is sent."}</p>
    <div className="filters">
      <Link className="button" href={`/${lang}/demo/side-by-side`}>{fr ? "Voir le client et l’équipe côte à côte" : "See the customer and the team side by side"}</Link>
      <Link className="outline" href={orderHref(lang)}>{fr ? "Commencer une commande" : "Start an order"}</Link>
    </div>
    {blockers.length > 0 && <p className="panel" role="alert">{fr ? "La boutique de test n’est pas encore ouverte aux commandes. " : "The test store is not open for orders yet. "}{role === "ADMIN"
      ? <Link href="/en/admin">{fr ? "Ouvrez l’administration et appliquez les réglages de démonstration." : "Open the admin and apply the demo settings."}</Link>
      : (fr ? "Un administrateur doit appliquer les réglages de démonstration." : "An administrator must apply the demo settings.")}</p>}
    <ol className="catalog-grid">
      {steps.map((step, i) => <li key={i} className="panel">
        <small>{i + 1}. {step.who[fr ? 0 : 1]}</small>
        <h2>{step.title[fr ? 0 : 1]}</h2>
        <p>{step.text[fr ? 0 : 1]}</p>
        <Link className="outline" href={step.href}>{step.action[fr ? 0 : 1]}</Link>
      </li>)}
    </ol>
    <p className="fine-print">{fr ? "L’écran de l’équipe et l’administration sont en anglais et demandent une connexion. " : "The team screen and the admin are in English and need a sign-in. "}<Link href={rewardsPath[lang]}>{fr ? "Règles du programme" : "How the program works"}</Link></p>
  </section>;
}
