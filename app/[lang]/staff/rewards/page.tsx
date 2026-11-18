import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { availableRewards, loyaltyProgram, lookupQr } from "../../../../src/loyalty";
import { staffRole } from "../../../../src/staff";
import { award, identify, redeem } from "./actions";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const errors: Record<string, [string, string]> = {
  QR_INVALID: ["Code invalide ou expiré. Demandez un nouveau code au client.", "Invalid or expired code. Ask the customer for a new code."],
  QR_USED: ["Ce code a déjà été utilisé.", "This code was already used."],
  QR_EXPIRED: ["Ce code a expiré. Demandez un nouveau code.", "This code has expired. Ask for a new code."],
  INSUFFICIENT_POINTS: ["Solde insuffisant pour cette récompense.", "Not enough points for this reward."],
  REWARD_UNAVAILABLE: ["Cette récompense n’est pas offerte.", "This reward is not offered."],
  PROGRAM_INACTIVE: ["Le programme n’est pas actif.", "The program is not active."],
  ACCOUNT_SUSPENDED: ["Ce compte de fidélité est suspendu.", "This loyalty account is suspended."],
  AMOUNT: ["Montant invalide.", "Invalid amount."], RATE: ["Trop d’opérations. Patientez une minute.", "Too many operations. Wait a minute."],
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
  const customer = str("t") ? await lookupQr(str("t"), db) : undefined;
  const rewards = customer ? await availableRewards(db) : [];
  const err = errors[str("error")];
  return <section className="wrap section">
    <div className="section-head"><h1>{fr ? "Récompenses Salut" : "Salut Rewards"}<span>.</span></h1><Link href={`/${lang}/staff`}>{fr ? "Commandes" : "Orders"}</Link></div>
    {!program.active && <p role="status" className="panel">{fr ? "Le programme n’est pas actif : ni gain ni échange de points." : "The program is not active: no earning or redeeming."}</p>}
    {err && <p role="alert" className="panel">{err[fr ? 0 : 1]}</p>}
    {str("done") && <p role="status" className="panel"><strong>{fr ? "Récompense remise" : "Reward given"}:</strong> {str("done")} · {fr ? "nouveau solde" : "new balance"} {str("balance")}{str("dup") && (fr ? " (déjà traité)" : " (already processed)")}</p>}
    {str("awarded") && <p role="status" className="panel">{fr ? "Points attribués" : "Points awarded"}: {str("awarded")}{str("balance") && ` · ${fr ? "solde" : "balance"} ${str("balance")}`}</p>}
    <form className="panel checkout" action={identify.bind(null, lang)}>
      <label>{fr ? "Lien ou code scanné" : "Scanned link or code"}<input name="scan" required maxLength={400} autoComplete="off" spellCheck={false}/></label>
      <button className="outline">{fr ? "Identifier le client" : "Identify customer"}</button>
    </form>
    {customer && <div className="panel" aria-live="polite">
      <h2>{customer.firstName} · {customer.memberCode}</h2>
      <p className="total">{fr ? "Solde" : "Balance"} <strong>{customer.balance} {fr ? "points" : "points"}</strong></p>
      {customer.status !== "active" ? <p role="alert">{errors.ACCOUNT_SUSPENDED[fr ? 0 : 1]}</p> : <>
        <h3>{fr ? "Échanger une récompense" : "Redeem a reward"}</h3>
        {!rewards.length && <p>{fr ? "Aucune récompense offerte." : "No rewards offered."}</p>}
        {rewards.map(r => <form key={r.id} action={redeem.bind(null, lang)} className="filters">
          <input type="hidden" name="token" value={str("t")}/><input type="hidden" name="reward" value={r.id}/><input type="hidden" name="key" value={`redeem-${randomUUID()}`}/>
          <span><strong>{fr ? r.name_fr : r.name_en}</strong> · {r.points_cost} pts</span>
          <button disabled={customer.balance < r.points_cost}>{fr ? "Confirmer l’échange" : "Confirm redemption"}</button>
        </form>)}
        <h3>{fr ? "Attribuer des points (achat en magasin)" : "Award points (in-store purchase)"}</h3>
        <form action={award.bind(null, lang)} className="filters">
          <input type="hidden" name="token" value={str("t")}/><input type="hidden" name="key" value={`award-${randomUUID()}`}/>
          <label>{fr ? "Montant avant taxes ($)" : "Amount before tax ($)"}<input name="amount" inputMode="decimal" required pattern="\d{1,4}(\.\d{1,2})?"/></label>
          <button className="outline">{fr ? "Attribuer" : "Award"}</button>
        </form></>}
      <p className="fine-print">{fr ? `Ce code expire à ${new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Toronto", timeStyle: "short" }).format(new Date(customer.expiresAt))}.` : `This code expires at ${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", timeStyle: "short" }).format(new Date(customer.expiresAt))}.`}</p>
    </div>}
  </section>;
}
