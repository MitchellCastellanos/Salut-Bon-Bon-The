import Link from "next/link";
import type { Metadata } from "next";
import { QrCard } from "../app/[lang]/account/qr-card";
import { officialLogo } from "./brand-server";
import type { Lang } from "./domain";
import { currentGuestCard } from "./guest-card";
import { accountHistory, loyaltyProgram } from "./loyalty";
import { rewardsPath } from "./rewards-paths";
import { forgetGuestCard, getGuestCard, restoreGuestCard } from "../app/[lang]/guest-card-actions";
import { rewardsName } from "./storefront-content";

export const cardMetadata = (lang: Lang): Metadata => ({
  title: lang === "fr" ? "Ma carte invité" : "My guest card", robots: { index: false, follow: false }, referrer: "no-referrer",
});
const errors = {
  rate: ["Trop de tentatives. Réessayez plus tard.", "Too many attempts. Try again later."],
  restore: ["Code de secours invalide.", "Invalid backup code."],
} as const;

export async function GuestCardPage({ lang, error, notice }: { lang: Lang; error?: string; notice?: string }) {
  const fr = lang === "fr";
  if (!process.env.DATABASE_URL) return <section className="wrap section narrow rw-card-page"><h1>{fr ? "Carte invité" : "Guest card"}<span>.</span></h1>
    <p role="status">{fr ? "La carte invité n’est pas disponible dans le mode démonstration sans base de données." : "Guest cards are not available in demo mode without a database."}</p></section>;
  const card = await currentGuestCard();
  const err = error && error in errors ? errors[error as keyof typeof errors][fr ? 0 : 1] : undefined;
  const program = await loyaltyProgram().catch(() => undefined);
  const history = card ? await accountHistory(card.account.id, 15) : [];
  const kind = (k: string) => k === "earn" ? (fr ? "Points gagnés" : "Points earned") : k === "redeem" ? (fr ? "Récompense échangée" : "Reward redeemed") : k === "reverse" ? (fr ? "Points repris (remboursement)" : "Points reversed (refund)") : (fr ? "Ajustement" : "Adjustment");
  return <section className="wrap section rw-card-page">
    <p className="eyebrow">{rewardsName[lang]}</p><h1>{fr ? "Ma carte invité" : "My guest card"}<span>.</span></h1>
    {err && <p role="alert" className="panel">{err}</p>}
    {notice && <p role="status" className="panel">{fr ? "Fait." : "Done."}</p>}
    {program && !program.active && <p role="status" className="panel">{fr ? "Aperçu : le programme n’est pas encore actif, aucun point n’est cumulé." : "Preview: the program is not active yet, no points are being earned."}</p>}
    {!card ? <>
      <p>{fr ? "Obtenez une carte numérique gratuite, sans compte ni mot de passe. Elle est liée à cet appareil; un code de secours vous permet de la retrouver ailleurs, et vous pourrez la lier à un compte plus tard sans perdre vos points." : "Get a free digital card with no account or password. It is tied to this device; a backup code lets you restore it elsewhere, and you can link it to an account later without losing points."}</p>
      <form action={getGuestCard.bind(null, lang)}><button className="button">{fr ? "Obtenir ma carte" : "Get my card"}</button></form>
      <h2>{fr ? "J’ai déjà une carte" : "I already have a card"}</h2>
      <form action={restoreGuestCard.bind(null, lang)} className="panel checkout"><label>{fr ? "Code de secours" : "Backup code"}<input name="code" required autoComplete="off" spellCheck={false} maxLength={80}/></label>
        <button className="outline">{fr ? "Restaurer ma carte" : "Restore my card"}</button></form>
    </> : <>
      <p className="total">{fr ? "Solde" : "Balance"} <strong>{card.account.balance} {fr ? "points" : "points"}</strong></p>
      <QrCard lang={lang} memberCode={card.account.member_code} logo={officialLogo()}/>
      <details className="panel"><summary>{fr ? "Code de secours (à garder privé)" : "Backup code (keep it private)"}</summary>
        <p>{fr ? "Ce code donne accès à votre carte. Conservez-le dans un endroit sûr; ne le partagez avec personne." : "This code gives access to your card. Store it somewhere safe and share it with no one."}</p>
        <code className="member-code" style={{ wordBreak: "break-all" }}>{card.secret}</code></details>
      <h2>{fr ? "Historique" : "History"}</h2>
      {!history.length ? <p>{fr ? "Aucune activité pour le moment." : "No activity yet."}</p> : <ul>{history.map(h => <li key={h.id}>{kind(h.kind)} · {h.points > 0 ? "+" : ""}{h.points}{h.order_number ? ` · #${h.order_number}` : ""} · {fr ? "solde" : "balance"} {h.balance_after}</li>)}</ul>}
      <p>{fr ? "Vous avez un compte ? Connectez-vous, puis liez cette carte depuis la page de votre carte Récompenses." : "Have an account? Sign in, then link this card from your Rewards card page."} <Link href={`/${lang}/account/rewards`}>{fr ? "Mon compte" : "My account"}</Link></p>
      <form action={forgetGuestCard.bind(null, lang)}><button className="outline">{fr ? "Retirer la carte de cet appareil" : "Remove the card from this device"}</button></form>
    </>}
    <p><Link href={rewardsPath[lang]}>{fr ? "← Retour à Récompenses Salut" : "← Back to Salut Rewards"}</Link></p>
  </section>;
}
