import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { usesOfficialCatalog } from "./catalog-mode";
import type { Lang } from "./domain";
import { publicRewards, type PublicRewards } from "./loyalty";
import { RewardsCalculator } from "./rewards-calculator";
import { StorefrontArt, StorefrontIcon } from "./storefront-art";
import { rewardsName } from "./storefront-content";

import { cardPath, rewardsPath } from "./rewards-paths";
export { cardPath, rewardsPath };

async function load(): Promise<PublicRewards | null> { return publicRewards().catch(() => null); }

const fmt = (lang: Lang) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA");
const cad = (lang: Lang, cents: number) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Localized metadata with canonical and FR/EN alternates. Descriptions state the program status honestly. */
export async function rewardsMetadata(lang: Lang): Promise<Metadata> {
  const data = await load();
  const fr = lang === "fr";
  const nf = fmt(lang);
  const terms = data?.pointsPerDollar && data.featured?.discountCents
    ? (fr ? `${nf.format(data.pointsPerDollar)} points par 1 $ admissible avant taxes; ${nf.format(data.featured.pointsCost)} points = ${cad(lang, data.featured.discountCents)} de rabais.`
      : `${nf.format(data.pointsPerDollar)} points per eligible $1 before tax; ${nf.format(data.featured.pointsCost)} points = ${cad(lang, data.featured.discountCents)} off.`) : "";
  const status = data?.operational ? "" : (fr ? " Programme en aperçu : pas encore actif." : " Program in preview: not active yet.");
  const base = {
    title: rewardsName[lang],
    description: fr ? `Découvrez ${rewardsName.fr} chez Salut Bon Bon Thé. ${terms}${status}` : `Discover ${rewardsName.en} at Salut Bon Bon Thé. ${terms}${status}`,
    ...(data && !data.previewVisible ? { robots: { index: false, follow: false } } : {}),
  };
  return process.env.SITE_URL ? { ...base, alternates: { canonical: rewardsPath[lang], languages: { "fr-CA": rewardsPath.fr, "en-CA": rewardsPath.en, "x-default": rewardsPath.fr } },
    openGraph: { title: rewardsName[lang], description: base.description, url: rewardsPath[lang], locale: fr ? "fr_CA" : "en_CA" } } : base;
}

const stateLabel = { available: ["Disponible", "Available"], coming_soon: ["Bientôt disponible", "Coming soon"], unavailable: ["Non disponible", "Unavailable"] } as const;

export async function RewardsPage({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const data = await load();
  if (data && !data.previewVisible) notFound();
  const nf = fmt(lang);
  const home = `/${lang}`;
  const menu = `${home}/${usesOfficialCatalog() ? "catalog" : "menu"}`;
  const featured = data?.featured ?? null;
  const percent = data?.percent ?? null;
  const rate = data?.pointsPerDollar ?? null;
  const operational = Boolean(data?.accrualOperational);
  const pct = percent === null ? null : nf.format(percent);
  const calculator = rate && featured?.discountCents ? { pointsPerDollar: rate, rewardCost: featured.pointsCost, rewardCents: featured.discountCents } : null;
  const faq: [string, string][] = fr ? [
    ["Est-ce gratuit ?", "Oui. Il n’y a aucun frais d’adhésion ni d’abonnement pour participer au programme."],
    ["Ai-je besoin d’un compte ?", "Non. Vous pouvez créer un compte client pour retrouver vos points, vos commandes et votre historique, ou obtenir une carte invité gratuite sans mot de passe. La carte invité est liée à cet appareil : conservez son code de secours, puis liez-la à un compte plus tard sans perdre vos points."],
    ["Comment gagner des points ?", rate ? `Vous gagnez ${nf.format(rate)} points par 1 $ admissible, avant taxes. Les taxes, les pourboires, les rabais, les récompenses échangées et les montants remboursés ne rapportent pas de points. Le calcul se fait une seule fois par commande, sur le sous-total admissible, arrondi à l’inférieur.` : "Les règles de calcul seront confirmées avant l’ouverture du programme."],
    ["Quand les points sont-ils crédités ?", "Pour une commande en ligne, une fois la commande remise et terminée par l’équipe (pas avant, et jamais pour une commande annulée). En magasin, au moment où l’équipe saisit l’achat après avoir scanné votre code."],
    ["Comment les utiliser ?", featured ? `Présentez votre code QR en caisse : l’équipe confirme l’échange de ${nf.format(featured.pointsCost)} points contre ${featured.discountCents ? cad(lang, featured.discountCents) + " de rabais" : "la récompense"} et l’applique à votre achat. L’échange se fait uniquement au comptoir; aucun rabais n’est appliqué automatiquement à la commande en ligne.` : "Les récompenses seront annoncées avant l’ouverture du programme."],
    ["Puis-je gagner des points en magasin ?", "Oui, lorsque le programme est actif : montrez votre code QR (compte ou carte invité) et l’équipe attribue les points sur le montant avant taxes. Ce code est à usage unique et expire après quelques minutes."],
    ["Que se passe-t-il en cas de remboursement ?", "Les points gagnés sur le montant remboursé sont repris, en proportion pour un remboursement partiel et en totalité pour un remboursement complet. Votre solde ne devient jamais négatif."],
    ["Puis-je combiner les points avec des promotions ?", "Aucune règle de cumul avec d’autres promotions n’a encore été approuvée. En attendant, les points se calculent sur le montant admissible après rabais, et une récompense échangée ne rapporte pas de points."],
    ["Les points expirent-ils ?", "Aucune politique d’expiration n’a été définie à ce jour. S’il y en a une, elle sera annoncée clairement avant l’activation du programme."],
  ] : [
    ["Is it free?", "Yes. There is no membership fee or subscription to take part."],
    ["Do I need an account?", "No. You can create a customer account to keep your points, orders and history, or get a free guest card with no password. A guest card is tied to this device: keep its backup code, then link it to an account later without losing points."],
    ["How do I earn points?", rate ? `You earn ${nf.format(rate)} points per eligible $1, before tax. Taxes, tips, discounts, redeemed rewards and refunded amounts earn nothing. Points are calculated once per order on the eligible subtotal, rounded down.` : "The earning rules will be confirmed before the program opens."],
    ["When are points credited?", "For online orders, once the team hands over and completes the order (never before, and never for a cancelled order). In store, when the team enters your purchase after scanning your code."],
    ["How do I use them?", featured ? `Show your QR code at the counter: the team confirms the exchange of ${nf.format(featured.pointsCost)} points for ${featured.discountCents ? cad(lang, featured.discountCents) + " off" : "the reward"} and applies it to your purchase. Redemption happens at the counter only; no discount is applied automatically to online orders.` : "Rewards will be announced before the program opens."],
    ["Can I earn points in store?", "Yes, once the program is active: show your QR code (account or guest card) and the team awards points on the pre-tax amount. The code is single-use and expires after a few minutes."],
    ["What happens with refunds?", "Points earned on the refunded amount are taken back: proportionally for a partial refund and entirely for a full refund. Your balance never goes below zero."],
    ["Can I combine points with promotions?", "No rule for combining with other promotions has been approved yet. Meanwhile, points are calculated on the eligible amount after discounts, and a redeemed reward earns no points."],
    ["Do points expire?", "No expiry policy has been defined so far. If one is adopted, it will be announced clearly before the program is activated."],
  ];
  const steps = [
    { icon: "bag", n: "1", t: fr ? "Commandez" : "Order", d: fr ? "Choisissez votre boisson en ligne pour la cueillette ou au comptoir." : "Pick your drink online for pickup, or at the counter." },
    { icon: "pearls", n: "2", t: fr ? "Cumulez" : "Earn", d: rate ? (fr ? `Chaque 1 $ admissible avant taxes vous rapporte ${nf.format(rate)} points.` : `Every eligible $1 before tax earns ${nf.format(rate)} points.`) : (fr ? "Les points s’accumulent sur vos achats admissibles." : "Points build up on your eligible purchases.") },
    { icon: "gift", n: "3", t: fr ? "Profitez" : "Enjoy", d: featured ? (fr ? `Échangez ${nf.format(featured.pointsCost)} points au comptoir${featured.discountCents ? ` contre ${cad(lang, featured.discountCents)} de rabais` : ""}.` : `Redeem ${nf.format(featured.pointsCost)} points at the counter${featured.discountCents ? ` for ${cad(lang, featured.discountCents)} off` : ""}.`) : (fr ? "Échangez vos points contre des récompenses." : "Redeem points for rewards.") },
  ] as const;
  return <div className="rw" data-testid="rewards-page">
    <div className="wrap">
      <section className="rw-hero" aria-labelledby="rw-title">
        <div>
          <p className={`rw-pill ${operational ? "live" : ""}`} data-testid="status-pill"><StorefrontIcon name="gift"/>{data === null ? (fr ? "Détails bientôt disponibles" : "Details coming soon") : operational ? (fr ? "Programme actif" : "Program active") : (fr ? "Aperçu : pas encore actif" : "Preview: not active yet")}</p>
          <h1 id="rw-title">{fr ? <>Chaque gorgée <em>vous récompense !</em></> : <>Every sip <em>rewards you!</em></>}</h1>
          <p className="rw-lead">{pct ? (fr ? <>Récupérez <strong>{pct} %</strong> de vos achats admissibles en points : {nf.format(rate ?? 0)} points par 1 $ avant taxes.</> : <>Get <strong>{pct}%</strong> of your eligible purchases back in points: {nf.format(rate ?? 0)} points per $1 before tax.</>) :
            (fr ? "Cumulez des points sur vos achats admissibles et échangez-les contre des récompenses." : "Earn points on eligible purchases and redeem them for rewards.")}</p>
          <div className="rw-cta"><Link className="button" href={menu}>{fr ? "Explorer le menu" : "Explore the menu"} <span aria-hidden="true">→</span></Link>
            <a className="outline" href="#how">{fr ? "Comment ça marche" : "How it works"}</a></div>
        </div>
        <div className="rw-photo"><StorefrontArt path="/drinks/mango.webp" sizes="(max-width: 820px) 92vw, 520px" priority alt={fr ? "Thé à la mangue frais, garni de cubes de mangue" : "Fresh mango tea topped with mango cubes"}><span/></StorefrontArt>
          {pct && <div className="rw-badge" aria-hidden="true"><b>{pct} %</b><small>{fr ? "en points" : "in points"}</small></div>}</div>
      </section>

      {!operational && data !== null && <p className="rw-note" role="note" data-testid="preview-note">{fr ? "Aperçu : le programme est présenté, mais l’accumulation et l’échange de points ne sont pas encore ouverts. Rien n’est crédité tant que la boutique ne l’a pas annoncé." : "Preview: the program is on display, but earning and redeeming points are not open yet. Nothing is credited until the store announces it."}</p>}

      <section className="rw-block" id="how" aria-labelledby="how-title"><h2 id="how-title">{fr ? "Comment ça marche" : "How it works"}</h2>
        <ol className="rw-steps">{steps.map(step => <li key={step.n}><StorefrontIcon name={step.icon}/><span className="rw-num">{fr ? "ÉTAPE" : "STEP"} {step.n}</span><h3>{step.t}</h3><p>{step.d}</p></li>)}</ol></section>

      <section className="rw-block" id="calculator" aria-labelledby="calc-title"><h2 id="calc-title">{fr ? "Calculez vos points" : "Calculate your points"}</h2>
        {calculator ? <div className="rw-calc-wrap"><div><p>{fr ? "Entrez un montant fictif pour voir combien de points il pourrait rapporter. Les valeurs viennent de la configuration réelle du programme." : "Enter a hypothetical amount to see how many points it could earn. Values come from the program’s real configuration."}</p>
          {data?.categoryRestricted && <p className="fine-print">{fr ? "Seules certaines catégories rapportent des points; la simulation suppose un montant entièrement admissible." : "Only some categories earn points; the simulation assumes a fully eligible amount."}</p>}
          {data && data.minOrderCents > 0 && <p className="fine-print">{fr ? `Achat minimal pour gagner des points : ${cad(lang, data.minOrderCents)}.` : `Minimum purchase to earn points: ${cad(lang, data.minOrderCents)}.`}</p>}</div>
          <RewardsCalculator {...calculator} preview={!operational} lang={lang}/></div> :
          <p className="rw-note" role="status">{fr ? "La simulation sera disponible dès que les règles du programme seront configurées." : "The simulator will be available once the program rules are configured."}</p>}</section>

      <section className="rw-block" id="rewards" aria-labelledby="rewards-title"><h2 id="rewards-title">{fr ? "Récompenses" : "Rewards"}</h2>
        {!data?.rewards.length ? <p>{fr ? "Les récompenses seront annoncées bientôt." : "Rewards will be announced soon."}</p> :
          <ul className="rw-cards">{[...data.rewards].sort((a, b) => Number(b.id === featured?.id) - Number(a.id === featured?.id)).map(reward => <li key={reward.id} className={`rw-card ${reward.state} ${reward.id === featured?.id ? "featured" : ""}`} data-state={reward.state}>
            <div><span className={`rw-state ${reward.state}`}>{stateLabel[reward.state][fr ? 0 : 1]}</span>
              <h3>{fr ? reward.nameFr : reward.nameEn} — {nf.format(reward.pointsCost)} {fr ? "points" : "points"}</h3>
              {(fr ? reward.descriptionFr : reward.descriptionEn) && <p>{fr ? reward.descriptionFr : reward.descriptionEn}</p>}
              {reward.state !== "available" && <p className="fine-print">{reward.state === "coming_soon" ? (fr ? "Pas encore échangeable." : "Not redeemable yet.") : (fr ? "Cette récompense n’est pas offerte pour le moment." : "This reward is not offered right now.")}</p>}</div>
            {reward.id === featured?.id && <div className="rw-art" aria-hidden="true"><StorefrontIcon name="gift"/></div>}
          </li>)}</ul>}</section>

      <section className="rw-block" id="participate" aria-labelledby="part-title"><h2 id="part-title">{fr ? "Comment participer" : "How to take part"}</h2>
        <div className="rw-ways">
          <article><h3>{fr ? "Avec un compte client" : "With a customer account"}</h3><p>{fr ? "Créez un compte (courriel vérifié), adhérez au programme, puis retrouvez votre solde, votre historique et votre code QR. Vos commandes en ligne connectées cumulent automatiquement des points une fois terminées." : "Create an account (verified email), join the program, then see your balance, history and QR code. Online orders placed while signed in earn points automatically once completed."}</p><Link className="outline" href={`${home}/account/rewards`}>{fr ? "Mon compte et ma carte" : "My account and card"}</Link></article>
          <article><h3>{fr ? "Sans compte : carte invité" : "No account: guest card"}</h3><p>{fr ? "Obtenez gratuitement une carte numérique avec un code QR, sans mot de passe. Présentez-la en caisse ; vos commandes en ligne passées depuis cet appareil s’y rattachent. Liez-la plus tard à un compte, sans doubler vos points." : "Get a free digital card with a QR code, no password. Show it at the counter; online orders placed from this device attach to it. Link it to an account later without doubling your points."}</p><Link className="outline" href={cardPath[lang]}>{fr ? "Obtenir ma carte invité" : "Get my guest card"}</Link></article>
          <article><h3>{fr ? "En magasin" : "In store"}</h3><p>{fr ? "Montrez votre code QR à l’équipe : elle l’identifie, attribue vos points sur le montant avant taxes ou confirme un échange. Le code est à usage unique et expire rapidement. Votre solde n’est jamais affiché publiquement." : "Show your QR code to the team: they identify you, award points on the pre-tax amount or confirm a redemption. The code is single-use and expires quickly. Your balance is never shown publicly."}</p></article>
        </div>
        <p className="rw-note">{fr ? "Les commandes passées sans compte ni carte invité ne peuvent pas être rattachées à un membre et ne rapportent pas de points." : "Orders placed with neither an account nor a guest card cannot be tied to a member and earn no points."}</p></section>

      <section className="rw-block rw-faq" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">{fr ? "Questions fréquentes" : "Frequently asked questions"}</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>

      <section className="rw-final" aria-labelledby="final-title"><h2 id="final-title">{fr ? "Prêt pour une gorgée qui rapporte ?" : "Ready for a sip that pays you back?"}</h2>
        <p>{fr ? "Explorez le menu et passez nous voir en boutique." : "Explore the menu and come visit us in store."}</p>
        <div className="rw-cta"><Link className="button" href={menu}>{fr ? "Explorer le menu" : "Explore the menu"} <span aria-hidden="true">→</span></Link>
          <Link className="outline" href={`${home}#find-us`}>{fr ? "Visiter la boutique" : "Visit the store"}</Link></div></section>
    </div>
  </div>;
}
