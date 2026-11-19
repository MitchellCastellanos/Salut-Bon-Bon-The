import { randomUUID } from "node:crypto";
import { AdminNav } from "../nav";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { accountHistory, loyaltyProgram, programStages, type Account, type Reward } from "../../../../src/loyalty";
import { staffRole } from "../../../../src/staff";
import { adjust, recordRefund, saveProgram, saveReward, setAccountStatus } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const errs: Record<string, [string, string]> = {
  program: ["Paramètres invalides.", "Invalid settings."], rate: ["Définissez un taux (points par dollar) avant d’activer le programme.", "Set an earning rate (points per dollar) before activating the program."],
  reward: ["Récompense invalide (identifiant, coûts et éligibilité).", "Invalid reward (identifier, cost and eligibility)."], adjust: ["Ajustement invalide : un motif est obligatoire.", "Invalid adjustment: a reason is required."],
  INSUFFICIENT_POINTS: ["Le solde ne peut pas devenir négatif.", "The balance cannot go negative."], IDEMPOTENCY_CONFLICT: ["Opération déjà traitée.", "Already processed."],
  NOT_AUTHORIZED: ["En production, l’activation exige l’autorisation commerciale du propriétaire (case à cocher).", "In production, activation requires the owner’s commercial authorization (checkbox)."],
  refund: ["Remboursement invalide : commande, montant avant taxes et motif sont obligatoires.", "Invalid refund: order, pre-tax amount and reason are required."],
  NO_EARN_FOR_ORDER: ["Aucun point n’a été gagné pour cette commande en ligne.", "No points were earned for this online order."],
  REFUND_EXCEEDS_PURCHASE: ["Le total remboursé dépasserait le montant admissible de la commande.", "Total refunds would exceed the order’s eligible amount."],
};

export default async function AdminRewards({ params, searchParams }: PageProps<"/[lang]/admin/rewards">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const query = await searchParams;
  const str = (k: string) => typeof query[k] === "string" ? query[k] as string : "";
  const db = await database();
  const program = await loyaltyProgram(db);
  const [{ rows: categories }, { rows: rewards }] = await Promise.all([
    db.query<{ id: string; fr: string; en: string }>("SELECT id, fr, en FROM catalog_categories ORDER BY id"),
    db.query<Reward>("SELECT * FROM loyalty_rewards ORDER BY points_cost, id"),
  ]);
  const stages = programStages(program);
  const yes = (v: boolean) => v ? (fr ? "Oui" : "Yes") : (fr ? "Non" : "No");
  const q = str("q").trim().slice(0, 254);
  const { rows: found } = q ? await db.query<Account & { name: string; email: string }>(`
    SELECT a.*, COALESCE(u."name", '(carte invité / guest card)') AS name, COALESCE(u."email", '—') AS email FROM loyalty_accounts a LEFT JOIN "user" u ON u."id" = a.user_id
    WHERE lower(u."email") = lower($1) OR a.member_code = upper($1) LIMIT 5`, [q]) : { rows: [] };
  const histories = await Promise.all(found.map(account => accountHistory(account.id, 40, db)));
  const { rows: recent } = await db.query<{ created_at: Date | string; points: number; reward_name: string | null; member_code: string }>(`
    SELECT t.created_at, t.points, t.reward_name, a.member_code FROM loyalty_transactions t JOIN loyalty_accounts a ON a.id = t.account_id
    WHERE t.kind = 'redeem' ORDER BY t.id DESC LIMIT 10`);
  const err = errs[str("error")];
  const fmt = (d: Date | string) => new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  return <section className="wrap catalog-page">
    <AdminNav lang={lang} current="rewards"/>
    <h1>{fr ? "Récompenses Salut" : "Salut Rewards"}</h1>
    {err && <p role="alert" className="panel">{err[fr ? 0 : 1]}</p>}
    {str("saved") && <p role="status" className="panel">{fr ? "Enregistré." : "Saved."}</p>}
    <section className="panel" aria-labelledby="stages" data-testid="stages">
      <h2 id="stages">{fr ? "États du programme" : "Program states"}</h2>
      <p>{fr ? "Cinq états distincts : l’aperçu public ne déclenche aucune opération réelle." : "Five separate states: the public preview never triggers real operations."}</p>
      <ul>
        <li><strong>{fr ? "Programme configuré" : "Program configured"}</strong> : {yes(stages.configured)}</li>
        <li><strong>{fr ? "Aperçu public visible" : "Public preview visible"}</strong> : {yes(stages.previewVisible)}</li>
        <li><strong>{fr ? "Accumulation opérationnelle" : "Earning operational"}</strong> : {yes(stages.accrualOperational)}</li>
        <li><strong>{fr ? "Échange opérationnel" : "Redemption operational"}</strong> : {yes(stages.redemptionOperational)}</li>
        <li><strong>{fr ? "Activation commerciale autorisée" : "Commercial activation authorized"}</strong> : {yes(stages.commercialAuthorized)}</li>
      </ul>
    </section>
    <form className="panel checkout" action={saveProgram.bind(null, lang)} aria-labelledby="program">
      <h2 id="program">{fr ? "Règles du programme" : "Program rules"}</h2>
      <p>{fr ? "Aperçu initial : 10 points par 1 $ (soit 5 % avec la récompense de 5 $ pour 1 000 points). Le programme reste inactif tant qu’il n’est pas activé ici." : "Initial preview: 10 points per $1 (5 % with the $5 for 1,000 points reward). The program stays inactive until it is activated here."}</p>
      <label><input type="checkbox" name="previewVisible" defaultChecked={program.previewVisible}/> {fr ? "Aperçu public visible (page, menu, accueil)" : "Public preview visible (page, menu, home)"}</label>
      <label><input type="checkbox" name="active" defaultChecked={program.active}/> {fr ? "Programme actif (interrupteur général des opérations)" : "Program active (master operations switch)"}</label>
      <label><input type="checkbox" name="accrualEnabled" defaultChecked={program.accrualEnabled}/> {fr ? "Accumulation permise lorsque actif" : "Earning allowed when active"}</label>
      <label><input type="checkbox" name="redemptionEnabled" defaultChecked={program.redemptionEnabled}/> {fr ? "Échanges permis lorsque actif" : "Redemption allowed when active"}</label>
      <label><input type="checkbox" name="commercialAuthorized" defaultChecked={program.commercialAuthorized}/> {fr ? "Activation commerciale autorisée par le propriétaire (obligatoire pour activer en production)" : "Commercial activation authorized by the owner (required to activate in production)"}</label>
      <label>{fr ? "Points par dollar dépensé (avant taxes)" : "Points per dollar spent (before tax)"}<input name="rate" inputMode="numeric" pattern="\d{1,3}" defaultValue={program.pointsPerDollar ?? ""}/></label>
      <label>{fr ? "Achat minimal pour gagner des points ($)" : "Minimum purchase to earn points ($)"}<input name="min" inputMode="decimal" pattern="\d{1,4}(\.\d{1,2})?" defaultValue={program.minOrderCents ? (program.minOrderCents / 100).toFixed(2) : ""}/></label>
      <fieldset><legend>{fr ? "Catégories admissibles au gain (aucune cochée = toutes)" : "Categories that earn points (none checked = all)"}</legend>
        {categories.map(c => <label key={c.id}><input type="checkbox" name="category" value={c.id} defaultChecked={program.earnCategories?.includes(c.id)}/> {fr ? c.fr : c.en}</label>)}</fieldset>
      <button className="button">{fr ? "Enregistrer le programme" : "Save program"}</button>
    </form>
    <h2>{fr ? "Récompenses" : "Rewards"}</h2>
    {[...rewards, undefined].map(r => <form key={r?.id ?? "new"} className="panel checkout" action={saveReward.bind(null, lang)}>
      <h3>{r ? (fr ? r.name_fr : r.name_en) : (fr ? "Nouvelle récompense" : "New reward")}</h3>
      <label>{fr ? "Identifiant (minuscules, chiffres, tirets)" : "Identifier (lowercase, digits, hyphens)"}<input name="id" required pattern="[a-z0-9-]{1,48}" defaultValue={r?.id} readOnly={Boolean(r)}/></label>
      <label>{fr ? "Nom (FR)" : "Name (FR)"}<input name="nameFr" required maxLength={120} defaultValue={r?.name_fr}/></label>
      <label>{fr ? "Nom (EN)" : "Name (EN)"}<input name="nameEn" required maxLength={120} defaultValue={r?.name_en}/></label>
      <label>{fr ? "Description (FR)" : "Description (FR)"}<input name="descFr" maxLength={400} defaultValue={r?.description_fr}/></label>
      <label>{fr ? "Description (EN)" : "Description (EN)"}<input name="descEn" maxLength={400} defaultValue={r?.description_en}/></label>
      <label>{fr ? "Coût en points" : "Cost in points"}<input name="cost" required inputMode="numeric" pattern="\d{1,6}" defaultValue={r?.points_cost}/></label>
      <label>{fr ? "Valeur du rabais en $ (facultatif, appliqué en caisse)" : "Discount value in $ (optional, applied at the counter)"}<input name="discount" inputMode="decimal" pattern="\d{1,4}(\.\d{1,2})?" defaultValue={r?.discount_cents ? (r.discount_cents / 100).toFixed(2) : ""}/></label>
      <label><input type="checkbox" name="previewVisible" defaultChecked={r ? r.preview_visible : true}/> {fr ? "Visible dans l’aperçu public" : "Visible in the public preview"}</label>
      <label>{fr ? "Catégorie admissible (facultatif)" : "Eligible category (optional)"}<select name="category" defaultValue={r?.eligible_category ?? ""}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{fr ? c.fr : c.en}</option>)}</select></label>
      <label>{fr ? "Produit admissible (code, facultatif)" : "Eligible product (code, optional)"}<input name="product" maxLength={64} defaultValue={r?.eligible_product_id ?? ""}/></label>
      <label><input type="checkbox" name="available" defaultChecked={r?.available}/> {fr ? "Offerte aux clients" : "Offered to customers"}</label>
      <button className="outline">{r ? (fr ? "Enregistrer" : "Save") : (fr ? "Créer" : "Create")}</button>
    </form>)}
    <form className="panel checkout" action={recordRefund.bind(null, lang)} aria-labelledby="refund">
      <h2 id="refund">{fr ? "Rembourser une commande en ligne (reprise des points)" : "Refund an online order (reverse points)"}</h2>
      <p>{fr ? "Saisissez le montant remboursé AVANT TAXES. Les points sont repris proportionnellement (arrondi à l’inférieur sur les points conservés) ; un remboursement complet reprend tous les points. Le solde ne devient jamais négatif : la part déjà dépensée est notée comme écart." : "Enter the refunded amount BEFORE TAX. Points are taken back proportionally (kept points are rounded down); a full refund takes back every point. The balance never goes negative: any part already spent is recorded as a shortfall."}</p>
      {str("saved") === "refund" && <p role="status">{fr ? `Points repris : ${str("reversed")} · écart non recouvrable : ${str("shortfall")}` : `Points reversed: ${str("reversed")} · unrecoverable shortfall: ${str("shortfall")}`}</p>}
      <input type="hidden" name="key" value={`refund-${randomUUID()}`}/>
      <label>{fr ? "Numéro de commande" : "Order number"}<input name="order" required inputMode="numeric" pattern="[1-9]\d{0,17}"/></label>
      <label>{fr ? "Montant remboursé avant taxes ($)" : "Refunded amount before tax ($)"}<input name="amount" required inputMode="decimal" pattern="\d{1,4}(\.\d{1,2})?"/></label>
      <label>{fr ? "Motif (obligatoire)" : "Reason (required)"}<input name="reason" required minLength={3} maxLength={280}/></label>
      <button className="outline">{fr ? "Enregistrer le remboursement" : "Record refund"}</button>
    </form>
    <h2>{fr ? "Clients" : "Customers"}</h2>
    <form method="get" className="filters" role="search"><label>{fr ? "Courriel ou numéro de membre (carte invité incluse)" : "Email or member number (guest cards included)"}<input name="q" maxLength={254} defaultValue={q}/></label><button className="outline">{fr ? "Rechercher" : "Search"}</button></form>
    {q && !found.length && <p>{fr ? "Aucun compte de fidélité trouvé." : "No loyalty account found."}</p>}
    {found.map((account, i) => <section className="panel" key={account.id}>
      <h3>{account.name} · {account.member_code}</h3><p>{account.email} · {fr ? "solde" : "balance"} <strong>{account.balance}</strong> · {fr ? "cumulé" : "lifetime"} {account.lifetime_earned} · {account.status}</p>
      <form action={adjust.bind(null, lang)} className="filters"><input type="hidden" name="account" value={account.id}/><input type="hidden" name="q" value={q}/><input type="hidden" name="key" value={`adjust-${randomUUID()}`}/>
        <label>{fr ? "Points (+/−)" : "Points (+/−)"}<input name="points" required pattern="-?\d{1,6}" inputMode="numeric"/></label>
        <label>{fr ? "Motif (obligatoire)" : "Reason (required)"}<input name="reason" required minLength={3} maxLength={300}/></label>
        <button className="outline">{fr ? "Ajuster" : "Adjust"}</button></form>
      <form action={setAccountStatus.bind(null, lang)}><input type="hidden" name="account" value={account.id}/><input type="hidden" name="q" value={q}/>
        <button className="outline" name="status" value={account.status === "active" ? "suspended" : "active"}>{account.status === "active" ? (fr ? "Suspendre" : "Suspend") : (fr ? "Réactiver" : "Reactivate")}</button></form>
      <ul>{histories[i].map(h => <li key={h.id}>{fmt(h.created_at)} · {h.kind} · {h.points > 0 ? "+" : ""}{h.points} → {h.balance_after}{h.reward_name ? ` · ${h.reward_name}` : ""}{h.reason ? ` · ${h.reason}` : ""}{h.order_number ? ` · #${h.order_number}` : ""} · <small>{h.actor}</small></li>)}</ul>
    </section>)}
    <h2>{fr ? "Derniers échanges" : "Latest redemptions"}</h2>
    {!recent.length ? <p>{fr ? "Aucun échange." : "No redemptions yet."}</p> : <ul>{recent.map((r, i) => <li key={i}>{fmt(r.created_at)} · {r.member_code} · {r.reward_name} · {r.points}</li>)}</ul>}
  </section>;
}
