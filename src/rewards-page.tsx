import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { usesOfficialCatalog } from "./catalog-mode";
import type { Lang } from "./domain";
import { publicRewards, type PublicRewards } from "./loyalty";
import { StampProgress } from "./stamp-progress";
import { StorefrontArt, StorefrontIcon } from "./storefront-art";
import { rewardsName } from "./storefront-content";

import { cardPath, rewardsPath } from "./rewards-paths";
export { cardPath, rewardsPath };

async function load(): Promise<PublicRewards | null> { return publicRewards().catch(() => null); }

const fmt = (lang: Lang) => new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA");

/** Localized metadata with canonical and FR/EN alternates. Descriptions state the program status honestly. */
export async function rewardsMetadata(lang: Lang): Promise<Metadata> {
  const data = await load();
  const fr = lang === "fr";
  const n = data?.stampsRequired ?? 9;
  const terms = fr ? `${n} boissons admissibles achetées, la ${n + 1}e est gratuite.` : `${n} eligible drinks purchased, the ${n + 1}th is free.`;
  const status = data?.operational ? "" : (fr ? " Programme en aperçu : pas encore actif." : " Program in preview: not active yet.");
  const base = {
    title: rewardsName[lang],
    description: fr ? `Découvrez ${rewardsName.fr} chez Salut Bon Bon Thé. ${terms}${status}` : `Discover ${rewardsName.en} at Salut Bon Bon Thé. ${terms}${status}`,
    ...(data && !data.previewVisible ? { robots: { index: false, follow: false } } : {}),
  };
  return process.env.SITE_URL ? { ...base, alternates: { canonical: rewardsPath[lang], languages: { "fr-CA": rewardsPath.fr, "en-CA": rewardsPath.en, "x-default": rewardsPath.fr } },
    openGraph: { title: rewardsName[lang], description: base.description, url: rewardsPath[lang], locale: fr ? "fr_CA" : "en_CA" } } : base;
}

export async function RewardsPage({ lang }: { lang: Lang }) {
  const fr = lang === "fr";
  const data = await load();
  if (data && !data.previewVisible) notFound();
  const nf = fmt(lang);
  const home = `/${lang}`;
  const menu = `${home}/${usesOfficialCatalog() ? "catalog" : "menu"}`;
  const featured = data?.featured ?? null;
  const n = data?.stampsRequired ?? 9;
  const nth = fr ? `${n + 1}e` : `${n + 1}th`;
  const cap = data?.maxStampsPerOrder ?? 10;
  const operational = Boolean(data?.accrualOperational);
  const faq: [string, string][] = fr ? [
    ["Est-ce gratuit ?", "Oui. Il n’y a aucun frais d’adhésion ni d’abonnement pour participer au programme."],
    ["Ai-je besoin d’un compte ?", "Non. Vous pouvez créer un compte client pour retrouver votre carte, vos commandes et votre historique, ou obtenir une carte invité gratuite sans mot de passe. La carte invité est liée à cet appareil : conservez son code de secours, puis liez-la à un compte plus tard sans perdre vos tampons."],
    ["Comment gagner des tampons ?", `Chaque boisson admissible achetée vous donne un tampon. Après ${n} tampons, votre ${nth} boisson est gratuite. Un maximum de ${cap} tampons peut être crédité par commande ou par passage en boutique.`],
    ["Quand les tampons sont-ils crédités ?", "Pour une commande en ligne, une fois la commande remise et terminée par l’équipe (pas avant, et jamais pour une commande annulée). En magasin, au moment où l’équipe saisit le nombre de boissons après avoir scanné votre code."],
    ["Comment obtenir ma boisson gratuite ?", `Présentez votre code QR au comptoir : l’équipe confirme l’échange de ${n} tampons contre une boisson gratuite et vous la prépare. L’échange se fait uniquement au comptoir; aucun rabais n’est appliqué automatiquement à la commande en ligne.`],
    ["Quelle boisson puis-je choisir ?", "Les règles précises (boissons admissibles et valeur maximale de la boisson gratuite) seront confirmées avant l’ouverture du programme."],
    ["Que se passe-t-il en cas de remboursement ?", "Les tampons gagnés sur les boissons remboursées sont repris, en proportion pour un remboursement partiel et en totalité pour un remboursement complet. Votre solde ne devient jamais négatif."],
    ["Puis-je combiner la boisson gratuite avec des promotions ?", "Aucune règle de cumul avec d’autres promotions n’a encore été approuvée. Une boisson gratuite échangée ne rapporte pas de tampon."],
    ["Les tampons expirent-ils ?", "Aucune politique d’expiration n’a été définie à ce jour. S’il y en a une, elle sera annoncée clairement avant l’activation du programme."],
  ] : [
    ["Is it free?", "Yes. There is no membership fee or subscription to take part."],
    ["Do I need an account?", "No. You can create a customer account to keep your card, orders and history, or get a free guest card with no password. A guest card is tied to this device: keep its backup code, then link it to an account later without losing stamps."],
    ["How do I earn stamps?", `Every eligible drink you buy earns one stamp. After ${n} stamps, your ${nth} drink is free. At most ${cap} stamps can be credited per order or counter visit.`],
    ["When are stamps credited?", "For online orders, once the team hands over and completes the order (never before, and never for a cancelled order). In store, when the team enters the number of drinks after scanning your code."],
    ["How do I get my free drink?", `Show your QR code at the counter: the team confirms the exchange of ${n} stamps for a free drink and prepares it for you. Redemption happens at the counter only; no discount is applied automatically to online orders.`],
    ["Which drink can I choose?", "The exact rules (eligible drinks and the maximum value of the free drink) will be confirmed before the program opens."],
    ["What happens with refunds?", "Stamps earned on refunded drinks are taken back: proportionally for a partial refund and entirely for a full refund. Your balance never goes below zero."],
    ["Can I combine the free drink with promotions?", "No rule for combining with other promotions has been approved yet. A redeemed free drink earns no stamp."],
    ["Do stamps expire?", "No expiry policy has been defined so far. If one is adopted, it will be announced clearly before the program is activated."],
  ];
  const steps = [
    { icon: "bag", n: "1", t: fr ? "Commandez" : "Order", d: fr ? "Choisissez votre boisson en ligne pour la cueillette ou au comptoir." : "Pick your drink online for pickup, or at the counter." },
    { icon: "pearls", n: "2", t: fr ? "Cumulez" : "Collect", d: fr ? `Chaque boisson admissible vous donne un tampon : ${n} tampons remplissent votre carte.` : `Every eligible drink earns a stamp: ${n} stamps fill your card.` },
    { icon: "gift", n: "3", t: fr ? "Savourez" : "Enjoy", d: fr ? `Votre ${nth} boisson est gratuite : présentez votre code au comptoir.` : `Your ${nth} drink is free: show your code at the counter.` },
  ] as const;
  return <div className="rw" data-testid="rewards-page">
    <div className="wrap">
      <section className="rw-hero" aria-labelledby="rw-title">
        <div>
          <p className={`rw-pill ${operational ? "live" : ""}`} data-testid="status-pill"><StorefrontIcon name="gift"/>{data === null ? (fr ? "Détails bientôt disponibles" : "Details coming soon") : operational ? (fr ? "Programme actif" : "Program active") : (fr ? "Aperçu : pas encore actif" : "Preview: not active yet")}</p>
          <h1 id="rw-title">{fr ? <>Chaque gorgée <em>vous récompense !</em></> : <>Every sip <em>rewards you!</em></>}</h1>
          <p className="rw-lead">{fr ? <>Achetez <strong>{n} boissons</strong>, la <strong>{nth}</strong> est gratuite. Suivez votre progression sur votre carte numérique.</> : <>Buy <strong>{n} drinks</strong>, the <strong>{nth}</strong> is free. Follow your progress on your digital card.</>}</p>
          <div className="rw-cta"><Link className="button" href={menu}>{fr ? "Explorer le menu" : "Explore the menu"} <span aria-hidden="true">→</span></Link>
            <a className="outline" href="#how">{fr ? "Comment ça marche" : "How it works"}</a></div>
        </div>
        <div className="rw-photo"><StorefrontArt path="/drinks/mango.webp" sizes="(max-width: 820px) 92vw, 520px" priority alt={fr ? "Thé à la mangue frais, garni de cubes de mangue" : "Fresh mango tea topped with mango cubes"}><span/></StorefrontArt>
          <div className="rw-badge" aria-hidden="true"><b>{n} + 1</b><small>{fr ? "la 10e gratuite" : "the 10th free"}</small></div></div>
      </section>

      {!operational && data !== null && <p className="rw-note" role="note" data-testid="preview-note">{fr ? "Aperçu : le programme est présenté, mais l’accumulation de tampons et l’échange de boissons gratuites ne sont pas encore ouverts. Rien n’est crédité tant que la boutique ne l’a pas annoncé." : "Preview: the program is on display, but earning stamps and redeeming free drinks are not open yet. Nothing is credited until the store announces it."}</p>}

      <section className="rw-block" id="how" aria-labelledby="how-title"><h2 id="how-title">{fr ? "Comment ça marche" : "How it works"}</h2>
        <ol className="rw-steps">{steps.map(step => <li key={step.n}><StorefrontIcon name={step.icon}/><span className="rw-num">{fr ? "ÉTAPE" : "STEP"} {step.n}</span><h3>{step.t}</h3><p>{step.d}</p></li>)}</ol></section>

      <section className="rw-block" id="card" aria-labelledby="card-title"><h2 id="card-title">{fr ? "Votre carte de tampons" : "Your stamp card"}</h2>
        <div className="rw-calc-wrap"><div><p>{fr ? `Chaque boisson admissible ajoute un tampon. À ${n} tampons, la prochaine boisson est gratuite, puis la carte recommence.` : `Every eligible drink adds a stamp. At ${n} stamps, your next drink is free, then the card starts over.`}</p>
          {data?.categoryRestricted && <p className="fine-print">{fr ? "Seules certaines catégories de boissons rapportent des tampons." : "Only some drink categories earn stamps."}</p>}
          {data && data.minOrderCents > 0 && <p className="fine-print">{fr ? `Achat minimal pour gagner des tampons : ${new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(data.minOrderCents / 100)}.` : `Minimum purchase to earn stamps: ${new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(data.minOrderCents / 100)}.`}</p>}</div>
          <StampProgress balance={Math.min(6, n)} lang={lang} required={n} example/></div></section>

      <section className="rw-block" id="rewards" aria-labelledby="rewards-title"><h2 id="rewards-title">{fr ? "Récompenses" : "Rewards"}</h2>
        {!data?.rewards.length ? <p>{fr ? "Les récompenses seront annoncées bientôt." : "Rewards will be announced soon."}</p> :
          <ul className="rw-cards">{[...data.rewards].sort((a, b) => Number(b.id === featured?.id) - Number(a.id === featured?.id)).map(reward => <li key={reward.id} className={`rw-card ${reward.state} ${reward.id === featured?.id ? "featured" : ""}`} data-state={reward.state}>
            <div><h3>{fr ? reward.nameFr : reward.nameEn} — {nf.format(reward.pointsCost)} {fr ? "tampons" : "stamps"}</h3>
              {(fr ? reward.descriptionFr : reward.descriptionEn) && <p>{fr ? reward.descriptionFr : reward.descriptionEn}</p>}
</div>
            {reward.id === featured?.id && <div className="rw-art" aria-hidden="true"><StorefrontIcon name="gift"/></div>}
          </li>)}</ul>}</section>

      <section className="rw-block" id="participate" aria-labelledby="part-title"><h2 id="part-title">{fr ? "Comment participer" : "How to take part"}</h2>
        <div className="rw-ways">
          <article><h3>{fr ? "Avec un compte client" : "With a customer account"}</h3><p>{fr ? "Créez un compte (courriel vérifié), adhérez au programme, puis retrouvez votre carte de tampons, votre historique et votre code QR. Vos commandes en ligne connectées cumulent automatiquement des tampons une fois terminées." : "Create an account (verified email), join the program, then see your stamp card, history and QR code. Online orders placed while signed in earn stamps automatically once completed."}</p><Link className="outline" href={`${home}/account/rewards`}>{fr ? "Mon compte et ma carte" : "My account and card"}</Link></article>
          <article><h3>{fr ? "Sans compte : carte invité" : "No account: guest card"}</h3><p>{fr ? "Obtenez gratuitement une carte numérique avec un code QR, sans mot de passe. Présentez-la en caisse ; vos commandes en ligne passées depuis cet appareil s’y rattachent. Liez-la plus tard à un compte, sans doubler vos tampons." : "Get a free digital card with a QR code, no password. Show it at the counter; online orders placed from this device attach to it. Link it to an account later without doubling your stamps."}</p><Link className="outline" href={cardPath[lang]}>{fr ? "Obtenir ma carte invité" : "Get my guest card"}</Link></article>
          <article><h3>{fr ? "En magasin" : "In store"}</h3><p>{fr ? "Montrez votre code QR à l’équipe : elle l’identifie, ajoute vos tampons selon le nombre de boissons achetées ou confirme votre boisson gratuite. Le code est à usage unique et expire rapidement. Votre carte n’est jamais affichée publiquement." : "Show your QR code to the team: they identify you, add stamps for the drinks you bought or confirm your free drink. The code is single-use and expires quickly. Your card is never shown publicly."}</p></article>
        </div>
        <p className="rw-note">{fr ? "Les commandes passées sans compte ni carte invité ne peuvent pas être rattachées à un membre et ne rapportent pas de tampons." : "Orders placed with neither an account nor a guest card cannot be tied to a member and earn no stamps."}</p></section>

      <section className="rw-block rw-faq" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">{fr ? "Questions fréquentes" : "Frequently asked questions"}</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>

      <section className="rw-final" aria-labelledby="final-title"><h2 id="final-title">{fr ? "Prêt pour une gorgée qui rapporte ?" : "Ready for a sip that pays you back?"}</h2>
        <p>{fr ? "Explorez le menu et passez nous voir en boutique." : "Explore the menu and come visit us in store."}</p>
        <div className="rw-cta"><Link className="button" href={menu}>{fr ? "Explorer le menu" : "Explore the menu"} <span aria-hidden="true">→</span></Link>
          <Link className="outline" href={`${home}#find-us`}>{fr ? "Visiter la boutique" : "Visit the store"}</Link></div></section>
    </div>
  </div>;
}
