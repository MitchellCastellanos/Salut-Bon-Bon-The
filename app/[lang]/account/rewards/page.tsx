import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { customerSession } from "../../../../src/customer";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { officialLogo } from "../../../../src/brand-server";
import { accountForUser, accountHistory, availableRewards, loyaltyProgram } from "../../../../src/loyalty";
import { rewardsName } from "../../../../src/storefront-content";
import { StorefrontArt } from "../../../../src/storefront-art";
import { hasPublicImage } from "../../../../src/storefront-art";
import { joinRewards } from "../actions";
import { currentGuestCard } from "../../../../src/guest-card";
import { rewardsPath } from "../../../../src/rewards-paths";
import { linkCardToAccount } from "../../guest-card-actions";
import { QrCard } from "../qr-card";

export const metadata = { robots: { index: false, follow: false } };

export default async function RewardsPage({ params, searchParams }: PageProps<"/[lang]/account/rewards">) {
  const { lang } = await params;
  const query = await searchParams;
  const link = typeof query.link === "string" ? query.link : "";
  const moved = typeof query.moved === "string" ? query.moved.replace(/\D/g, "").slice(0, 7) : "";
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const session = await customerSession();
  if (!session) redirect(`/${lang}/account`);
  const db = await database();
  const account = await accountForUser(session.id, db);
  const program = await loyaltyProgram(db);
  const guest = await currentGuestCard();
  const linkMessages: Record<string, [string, string]> = {
    ok: [`Carte invité liée à votre compte${moved && moved !== "0" ? ` : ${moved} points transférés` : ""}.`, `Guest card linked to your account${moved && moved !== "0" ? `: ${moved} points moved` : ""}.`],
    none: ["Aucune carte invité valide sur cet appareil (ou déjà liée).", "No valid guest card on this device (or already linked)."],
    rate: ["Trop de tentatives. Réessayez plus tard.", "Too many attempts. Try again later."],
    suspended: ["Votre compte de fidélité est suspendu : liaison impossible.", "Your loyalty account is suspended: linking is not possible."],
  };
  const linkBox = <>
    {link && linkMessages[link] && <p role="status" className="panel">{linkMessages[link][fr ? 0 : 1]}</p>}
    {guest && <form className="panel" action={linkCardToAccount.bind(null, lang)}><p>{fr ? "Une carte invité est enregistrée sur cet appareil. Liez-la à ce compte : ses points sont déplacés (jamais copiés) et la carte cesse de fonctionner." : "A guest card is stored on this device. Link it to this account: its points are moved (never copied) and the card stops working."}</p>
      <button className="outline">{fr ? "Lier ma carte invité" : "Link my guest card"}</button></form>}
  </>;
  if (!account) return <section className="wrap section narrow"><p className="eyebrow">{rewardsName[lang]}</p><h1>{rewardsName[lang]}<span>.</span></h1>
    <p>{fr ? "Adhérez gratuitement pour obtenir votre carte et cumuler des points sur vos achats admissibles." : "Join for free to get your card and earn points on eligible purchases."}</p>
    <form action={joinRewards.bind(null, lang)}><button className="button">{fr ? "Adhérer à Récompenses Salut" : "Join Salut Rewards"}</button></form>
    {linkBox}<p><Link href={rewardsPath[lang]}>{fr ? "Voir comment fonctionne le programme" : "See how the program works"}</Link></p></section>;
  const [rewards, history] = await Promise.all([availableRewards(db), accountHistory(account.id, 30, db)]);
  const kind = (k: string) => k === "earn" ? (fr ? "Points gagnés" : "Points earned") : k === "redeem" ? (fr ? "Récompense échangée" : "Reward redeemed") : k === "reverse" ? (fr ? "Points repris (remboursement)" : "Points reversed (refund)") : (fr ? "Ajustement" : "Adjustment");
  return <section className="wrap section">
    {hasPublicImage("/rewards/campaign-banner.webp") && <div className="art-banner"><StorefrontArt path="/rewards/campaign-banner.webp" sizes="(max-width: 900px) 100vw, 1100px" priority/></div>}
    <div className="section-head"><div><p className="eyebrow">{rewardsName[lang]}</p><h1>{rewardsName[lang]}<span>.</span></h1></div><Link href={`/${lang}/account`}>{fr ? "Mon compte" : "My account"}</Link></div>
    {linkBox}
    <p><Link href={rewardsPath[lang]}>{fr ? "Comment fonctionne le programme" : "How the program works"}</Link></p>
    <p className="total">{fr ? "Solde" : "Balance"} <strong>{account.balance} {fr ? "points" : "points"}</strong></p>
    {!program.active && <p role="status" className="panel">{fr ? "Aperçu : le programme n’est pas actif pour le moment : aucun point n’est cumulé et aucune récompense ne peut être échangée." : "The program is not active right now: no points are earned and no rewards can be redeemed."}</p>}
    {account.status === "suspended" && <p role="alert" className="panel">{fr ? "Votre compte de fidélité est suspendu. Communiquez avec nous." : "Your loyalty account is suspended. Please contact us."}</p>}
    <div className="order-grid">
      {account.status === "active" && <QrCard lang={lang} memberCode={account.member_code} logo={officialLogo()} background={hasPublicImage("/rewards/card-background.webp") ? "/rewards/card-background.webp" : undefined}/>}
      <section className="panel" aria-labelledby="available"><h2 id="available">{fr ? "Récompenses disponibles" : "Available rewards"}</h2>
        {!rewards.length ? <p>{program.active ? (fr ? "Aucune récompense n’est offerte pour le moment." : "No rewards are offered right now.") : (fr ? "Les récompenses apparaîtront ici lorsque le programme sera actif." : "Rewards will appear here once the program is active.")}</p> :
          <ul>{rewards.map(r => <li key={r.id}><strong>{fr ? r.name_fr : r.name_en}</strong> · {r.points_cost} {fr ? "points" : "points"}
            {(fr ? r.description_fr : r.description_en) && <><br/><small>{fr ? r.description_fr : r.description_en}</small></>}
            <br/><small>{account.balance >= r.points_cost ? (fr ? "Vous avez assez de points. Présentez votre code au comptoir." : "You have enough points. Show your code at the counter.") : (fr ? `Il vous manque ${r.points_cost - account.balance} points.` : `${r.points_cost - account.balance} points to go.`)}</small></li>)}</ul>}
      </section>
    </div>
    <h2>{fr ? "Historique" : "History"}</h2>
    {!history.length ? <p>{fr ? "Aucune activité pour le moment." : "No activity yet."}</p> :
      <ul className="catalog-grid">{history.map(h => <li key={h.id}><strong>{kind(h.kind)}</strong>
        <small>{new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(h.created_at))}{h.reward_name ? ` · ${h.reward_name}` : ""}</small>
        <span>{h.points > 0 ? "+" : ""}{h.points} · {fr ? "solde" : "balance"} {h.balance_after}</span></li>)}</ul>}
  </section>;
}
