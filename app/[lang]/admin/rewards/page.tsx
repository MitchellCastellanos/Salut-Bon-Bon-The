import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { accountHistory, loyaltyProgram, type Account, type Reward } from "../../../../src/loyalty";
import { staffRole } from "../../../../src/staff";
import { adjust, saveProgram, saveReward, setAccountStatus } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const errs: Record<string, [string, string]> = {
  program: ["Paramètres invalides.", "Invalid settings."], rate: ["Définissez un taux (points par dollar) avant d’activer le programme.", "Set an earning rate (points per dollar) before activating the program."],
  reward: ["Récompense invalide (identifiant, coûts et éligibilité).", "Invalid reward (identifier, cost and eligibility)."], adjust: ["Ajustement invalide : un motif est obligatoire.", "Invalid adjustment: a reason is required."],
  INSUFFICIENT_POINTS: ["Le solde ne peut pas devenir négatif.", "The balance cannot go negative."], IDEMPOTENCY_CONFLICT: ["Opération déjà traitée.", "Already processed."],
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
  const q = str("q").trim().slice(0, 254);
  const { rows: found } = q ? await db.query<Account & { name: string; email: string }>(`
    SELECT a.*, u."name", u."email" FROM loyalty_accounts a JOIN "user" u ON u."id" = a.user_id
    WHERE lower(u."email") = lower($1) OR a.member_code = upper($1) LIMIT 5`, [q]) : { rows: [] };
  const histories = await Promise.all(found.map(account => accountHistory(account.id, 40, db)));
  const { rows: recent } = await db.query<{ created_at: Date | string; points: number; reward_name: string | null; member_code: string }>(`
    SELECT t.created_at, t.points, t.reward_name, a.member_code FROM loyalty_transactions t JOIN loyalty_accounts a ON a.id = t.account_id
    WHERE t.kind = 'redeem' ORDER BY t.id DESC LIMIT 10`);
  const err = errs[str("error")];
  const fmt = (d: Date | string) => new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/admin`}>{fr ? "Administration" : "Administration"}</Link>
    <h1>{fr ? "Récompenses Salut" : "Salut Rewards"}</h1>
    {err && <p role="alert" className="panel">{err[fr ? 0 : 1]}</p>}
    {str("saved") && <p role="status" className="panel">{fr ? "Enregistré." : "Saved."}</p>}
    <form className="panel checkout" action={saveProgram.bind(null, lang)} aria-labelledby="program">
      <h2 id="program">{fr ? "Règles du programme" : "Program rules"}</h2>
      <p>{fr ? "Le programme est inactif par défaut. Aucun taux ni seuil n’est prédéfini : saisissez les valeurs approuvées par le propriétaire." : "The program is inactive by default. No rate or threshold is predefined: enter the owner-approved values."}</p>
      <label><input type="checkbox" name="active" defaultChecked={program.active}/> {fr ? "Programme actif (gain et échange de points)" : "Program active (earning and redeeming)"}</label>
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
      <label>{fr ? "Catégorie admissible (facultatif)" : "Eligible category (optional)"}<select name="category" defaultValue={r?.eligible_category ?? ""}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{fr ? c.fr : c.en}</option>)}</select></label>
      <label>{fr ? "Produit admissible (code, facultatif)" : "Eligible product (code, optional)"}<input name="product" maxLength={64} defaultValue={r?.eligible_product_id ?? ""}/></label>
      <label><input type="checkbox" name="available" defaultChecked={r?.available}/> {fr ? "Offerte aux clients" : "Offered to customers"}</label>
      <button className="outline">{r ? (fr ? "Enregistrer" : "Save") : (fr ? "Créer" : "Create")}</button>
    </form>)}
    <h2>{fr ? "Clients" : "Customers"}</h2>
    <form method="get" className="filters" role="search"><label>{fr ? "Courriel ou numéro de membre" : "Email or member number"}<input name="q" maxLength={254} defaultValue={q}/></label><button className="outline">{fr ? "Rechercher" : "Search"}</button></form>
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
