import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { availableRewards, loyaltyProgram, lookupQr } from "../../../../src/loyalty";
import { staffRole } from "../../../../src/staff";
import { maxStampsPerOrder } from "../../../../src/rewards-math";
import { StampProgress } from "../../../../src/stamp-progress";
import { identifierPattern, lookupIdentifier } from "../../../../src/identification";
import { award, identify, redeem } from "./actions";
import { ScanButton } from "./scan-button";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const errors: Record<string, [string, string]> = {
  QR_INVALID: ["Code invalide ou expiré. Demandez un nouveau code au client.", "Invalid or expired code. Ask the customer for a new code."],
  QR_USED: ["Ce code a déjà été utilisé.", "This code was already used."],
  QR_EXPIRED: ["Ce code a expiré. Demandez un nouveau code.", "This code has expired. Ask for a new code."],
  INSUFFICIENT_POINTS: ["Pas assez de tampons pour cette récompense.", "Not enough stamps for this reward."],
  REWARD_UNAVAILABLE: ["Cette récompense n’est pas offerte.", "This reward is not offered."],
  PROGRAM_INACTIVE: ["Le programme n’est pas actif.", "The program is not active."],
  ACCOUNT_SUSPENDED: ["Ce compte de fidélité est suspendu.", "This loyalty account is suspended."],
  ACCRUAL_DISABLED: ["L’accumulation de tampons est désactivée.", "Earning stamps is switched off."],
  REDEMPTION_DISABLED: ["Les échanges sont désactivés.", "Redemption is switched off."],
  CONFIRM: ["Confirmez que le client est présent.", "Confirm that the member is present."], NOT_AUTHORIZED: ["L’échange par carte n’est pas autorisé : demandez le code temporaire au client.", "Redemption by card is not allowed: ask the member for the single-use code."],
  AMOUNT: ["Nombre de boissons invalide.", "Invalid number of drinks."], RATE: ["Trop d’opérations. Patientez une minute.", "Too many operations. Wait a minute."],
  FAILED: ["Opération impossible.", "The operation could not be completed."], IDEMPOTENCY_CONFLICT: ["Opération déjà traitée avec d’autres valeurs.", "Already processed with different values."],
};

export default async function StaffRewards({ params, searchParams }: PageProps<"/[lang]/staff/rewards">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL) notFound();
  const fr = lang === "fr";
  if (!await staffRole()) return <section className="wrap section narrow"><h1>{fr ? "Récompenses" : "Rewards"}<span>.</span></h1>
    <p role="status">{fr ? "Connectez-vous à l’espace équipe, puis scannez de nouveau le code." : "Sign in to the staff area, then scan the code again."}</p>
    <Link className="button" href={`/${lang}/staff`}>{fr ? "Espace équipe" : "Staff area"}</Link></section>;
  const q = await searchParams;
  const str = (k: string) => typeof q[k] === "string" ? q[k] as string : "";
  const db = await database();
  const program = await loyaltyProgram(db);
  const stable = identifierPattern.test(str("id")) ? str("id") : "";
  const customer = str("t") ? await lookupQr(str("t"), db) : stable ? await lookupIdentifier(stable, db) : undefined;
  const rewards = customer ? await availableRewards(db) : [];
  // A scanned code that no longer identifies anyone (expired, used or superseded) is explained instead of silently ignored.
  const err = errors[str("error")] ?? ((str("t") || str("id")) && !customer ? errors.QR_INVALID : undefined);
  return <section className="wrap section">
    <div className="section-head"><h1>{fr ? "Récompenses Salut" : "Salut Rewards"}<span>.</span></h1><Link href={`/${lang}/staff`}>{fr ? "Commandes" : "Orders"}</Link></div>
    {!program.active && <p role="status" className="panel">{fr ? "Le programme n’est pas actif : ni tampons ni échanges." : "The program is not active: no stamps or redemptions."}</p>}
    {program.active && !program.accrualEnabled && <p role="status" className="panel">{fr ? "L’accumulation est désactivée : n’ajoutez pas de tampons." : "Earning is switched off: do not add stamps."}</p>}
    {program.active && !program.redemptionEnabled && <p role="status" className="panel">{fr ? "Les échanges sont désactivés." : "Redemption is switched off."}</p>}
    {err && <p role="alert" className="panel">{err[fr ? 0 : 1]}</p>}
    {str("done") && <p role="status" className="panel"><strong>{fr ? "Récompense remise" : "Reward given"}:</strong> {str("done")} · {fr ? "tampons restants" : "stamps left"} {str("balance")}{str("dup") && (fr ? " (déjà traité)" : " (already processed)")}</p>}
    {str("awarded") && <p role="status" className="panel">{fr ? "Tampons ajoutés" : "Stamps added"}: {str("awarded")}{str("balance") && ` · ${fr ? "total" : "total"} ${str("balance")}`}</p>}
    <form className="panel checkout" action={identify.bind(null, lang)}>
      <label>{fr ? "Lien ou code scanné" : "Scanned link or code"}<input id="scan-input" name="scan" required maxLength={400} autoComplete="off" spellCheck={false}/></label>
      <button className="outline">{fr ? "Identifier le client" : "Identify customer"}</button>
      <ScanButton inputId="scan-input" label="Scan with the camera" unsupported="This browser cannot scan in the page: open the customer's QR with the phone camera app, use a barcode scanner, or paste the link above."/>
    </form>
    {customer && <div className="panel" aria-live="polite">
      <h2>{customer.firstName ?? (fr ? "Invité (carte numérique)" : "Guest (digital card)")} · {customer.memberCode}</h2>
      <StampProgress balance={customer.balance} lang={lang} required={rewards.find(r => r.id === "free-drink")?.points_cost}/>
      {customer.status !== "active" ? <p role="alert">{errors.ACCOUNT_SUSPENDED[fr ? 0 : 1]}</p> : <>
        <h3>{fr ? "Échanger une récompense" : "Redeem a reward"}</h3>
        {program.freeDrinkMaxCents && <p className="fine-print">{fr ? `Boisson gratuite : jusqu’à ${(program.freeDrinkMaxCents / 100).toFixed(2)} $ (prix du format régulier). Les extras sont au prix habituel.` : `Free drink: worth up to $${(program.freeDrinkMaxCents / 100).toFixed(2)} (regular size price). Extras are charged normally.`}</p>}
        {stable && !program.identifierRedemption && <p role="alert">{errors.NOT_AUTHORIZED[fr ? 0 : 1]}</p>}
        {!rewards.length && <p>{fr ? "Aucune récompense offerte." : "No rewards offered."}</p>}
        {rewards.map(r => <form key={r.id} action={redeem.bind(null, lang)} className="filters">
          <input type="hidden" name="token" value={str("t")}/><input type="hidden" name="id" value={stable}/><input type="hidden" name="reward" value={r.id}/><input type="hidden" name="key" value={`redeem-${randomUUID()}`}/>
          <span><strong>{fr ? r.name_fr : r.name_en}</strong> · {r.points_cost} {fr ? "tampons" : "stamps"}{r.discount_cents ? ` · ${fr ? "rabais de" : "discount of"} ${(r.discount_cents / 100).toFixed(2)} $` : ""}</span>
          {stable && <label><input type="checkbox" name="present" required/> {fr ? "Le client est présent et m’a montré sa carte" : "The member is present and showed me their card"}</label>}
          <button disabled={customer.balance < r.points_cost || (Boolean(stable) && !program.identifierRedemption)}>{fr ? "Confirmer l’échange (puis préparer la boisson gratuite)" : "Confirm redemption (then prepare the free drink)"}</button>
        </form>)}
        <h3>{fr ? "Ajouter des tampons (achat en magasin)" : "Add stamps (in-store purchase)"}</h3>
        <form action={award.bind(null, lang)} className="filters">
          <input type="hidden" name="token" value={str("t")}/><input type="hidden" name="id" value={stable}/><input type="hidden" name="key" value={`award-${randomUUID()}`}/>
          <label>{fr ? `Boissons admissibles achetées (1 à ${maxStampsPerOrder}, hors boisson gratuite)` : `Eligible drinks bought (1 to ${maxStampsPerOrder}, free drink excluded)`}<input name="drinks" type="number" inputMode="numeric" min={1} max={maxStampsPerOrder} step={1} required/></label>
          <button className="outline">{fr ? "Ajouter les tampons" : "Add stamps"}</button>
        </form></>}
      {str("t") && <p className="fine-print">{fr ? `Ce code expire à ${new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", timeStyle: "short" }).format(new Date((customer as unknown as { expiresAt: string }).expiresAt))}.` : `This code expires at ${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", timeStyle: "short" }).format(new Date((customer as unknown as { expiresAt: string }).expiresAt))}.`}</p>}
    </div>}
  </section>;
}
