import { randomUUID } from "node:crypto";
import { database } from "../../../../src/db";
import { accountHistory, loyaltyProgram, programStages, type Account, type Reward } from "../../../../src/loyalty";
import { adminPage } from "../guard";
import { Badge, LiveNote, Notice, PageHeader } from "../ui";
import { Submit } from "../submit";
import { adjust, saveProgram, saveReward, setAccountStatus } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const errors: Record<string, string> = {
  program: "Those settings are not valid.", rate: "The program could not be configured.",
  reward: "That reward is not valid.", adjust: "Adjustment not valid: a reason of at least 3 characters is required.",
  INSUFFICIENT_POINTS: "A balance cannot go below zero.", IDEMPOTENCY_CONFLICT: "That change was already applied.",
  NOT_AUTHORIZED: "In production, turning the program on requires the owner’s authorization (tick the authorization box).",
};
const saves: Record<string, string> = { program: "Program rules saved.", reward: "Reward saved.", adjust: "Stamps adjusted and recorded in the customer’s history.", account: "Customer status updated." };

export default async function AdminRewards({ params, searchParams }: PageProps<"/[lang]/admin/rewards">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const str = (k: string) => typeof query[k] === "string" ? query[k] as string : "";
  const db = await database();
  const program = await loyaltyProgram(db);
  const [{ rows: categories }, { rows: rewards }] = await Promise.all([
    db.query<{ id: string; en: string }>("SELECT id, en FROM catalog_categories ORDER BY id"),
    db.query<Reward>("SELECT * FROM loyalty_rewards ORDER BY points_cost, id"),
  ]);
  const stages = programStages(program);
  const q = str("q").trim().slice(0, 254);
  const { rows: found } = q ? await db.query<Account & { name: string; email: string }>(`
    SELECT a.*, COALESCE(u."name", '(guest card)') AS name, COALESCE(u."email", '—') AS email FROM loyalty_accounts a LEFT JOIN "user" u ON u."id" = a.user_id
    WHERE lower(u."email") = lower($1) OR a.member_code = upper($1) LIMIT 5`, [q]) : { rows: [] };
  const histories = await Promise.all(found.map(account => accountHistory(account.id, 40, db)));
  const { rows: recent } = await db.query<{ created_at: Date | string; reward_name: string | null; member_code: string; actor: string }>(`
    SELECT t.created_at, t.reward_name, a.member_code, t.actor FROM loyalty_transactions t JOIN loyalty_accounts a ON a.id = t.account_id WHERE t.kind = 'redeem' ORDER BY t.id DESC LIMIT 10`);
  const when = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
  const state = (on: boolean, yes: string, no: string) => <Badge tone={on ? "good" : "neutral"}>{on ? yes : no}</Badge>;
  return <section className="wrap">
    <PageHeader title="Rewards program" intro="Salut Rewards 9+1: customers earn a stamp for each drink; after 9 stamps the 10th drink is free. Turn the program on, set its limits, and look after individual cards here."/>
    <Notice saved={query.saved} error={query.error} saves={saves} errors={errors}/>
    <section className="panel" aria-labelledby="status" data-testid="stages">
      <h2 id="status" style={{ marginTop: 0 }}>Where the program stands</h2>
      <ul>
        <li>Rewards page visible to customers: {state(stages.previewVisible, "Yes", "No")}</li>
        <li>Program running: {state(stages.configured && program.active, "Yes", "Off")}</li>
        <li>Customers earn stamps: {state(stages.accrualOperational, "Yes", "No")}</li>
        <li>Free drinks can be redeemed: {state(stages.redemptionOperational, "Yes", "No")}</li>
        <li>Owner’s authorization for real customers: {state(stages.commercialAuthorized, "Recorded", "Not recorded")}</li>
      </ul>
    </section>
    <LiveNote/>
    <form className="admin-form" action={saveProgram.bind(null, lang)} aria-labelledby="program">
      <h2 id="program">Program rules</h2>
      <label><input type="checkbox" name="previewVisible" defaultChecked={program.previewVisible}/> Show the Rewards page and card promotion on the website</label>
      <label><input type="checkbox" name="active" defaultChecked={program.active}/> Program on (master switch for stamps and rewards)</label>
      <label><input type="checkbox" name="accrualEnabled" defaultChecked={program.accrualEnabled}/> Customers earn stamps when the program is on</label>
      <label><input type="checkbox" name="redemptionEnabled" defaultChecked={program.redemptionEnabled}/> Customers can redeem free drinks when the program is on</label>
      <label><input type="checkbox" name="commercialAuthorized" defaultChecked={program.commercialAuthorized}/> I, the owner, authorize this program for real customers (required to turn it on in production)</label>
      <label>Highest price of a free drink ($, regular size)<input name="freeDrink" inputMode="decimal" pattern="\d{1,2}(\.\d{1,2})?" defaultValue={program.freeDrinkMaxCents ? (program.freeDrinkMaxCents / 100).toFixed(2) : ""}/><span className="hint">Drinks above this price cannot be the free one. Extras are paid at the normal price.</span></label>
      <label><input type="checkbox" name="identifierRedemption" defaultChecked={program.identifierRedemption}/> Staff may redeem for a member identified by their card (QR or Wallet) after confirming the member is present. Untick to require the customer’s one-time code.</label>
      <label>Minimum purchase to earn stamps ($, optional)<input name="min" inputMode="decimal" pattern="\d{1,4}(\.\d{1,2})?" defaultValue={program.minOrderCents ? (program.minOrderCents / 100).toFixed(2) : ""}/></label>
      <fieldset><legend>Drink categories that earn stamps</legend><p className="hint">Tick none to let every drink earn a stamp.</p>
        <div className="admin-checks">{categories.map(c => <label key={c.id}><input type="checkbox" name="category" value={c.id} defaultChecked={program.earnCategories?.includes(c.id)}/> {c.en}</label>)}</div></fieldset>
      <div><Submit confirm="Save the program rules? Changes to earning and redemption apply to the next scan or order.">Save program rules</Submit></div>
    </form>
    <h2>The reward</h2>
    {rewards.map(r => <form key={r.id} className="admin-form" action={saveReward.bind(null, lang)}>
      <input type="hidden" name="id" value={r.id}/><input type="hidden" name="cost" value={r.points_cost}/><input type="hidden" name="category" value={r.eligible_category ?? ""}/><input type="hidden" name="product" value={r.eligible_product_id ?? ""}/>
      <input type="hidden" name="discount" value={r.discount_cents ? (r.discount_cents / 100).toFixed(2) : ""}/>
      <h2>{r.name_en} <Badge>{r.points_cost} stamps</Badge></h2>
      <div className="admin-cols"><label>English name<input name="nameEn" required maxLength={120} defaultValue={r.name_en}/></label><label>French name<input name="nameFr" required maxLength={120} defaultValue={r.name_fr}/></label></div>
      <div className="admin-cols"><label>English description<input name="descEn" maxLength={400} defaultValue={r.description_en}/></label><label>French description<input name="descFr" maxLength={400} defaultValue={r.description_fr}/></label></div>
      <label><input type="checkbox" name="available" defaultChecked={r.available}/> Offered to customers</label>
      <label><input type="checkbox" name="previewVisible" defaultChecked={r.preview_visible}/> Shown on the public Rewards page</label>
      <div><Submit className="outline">Save reward</Submit></div>
    </form>)}
    <p className="admin-hint">The number of stamps for the free drink is part of the 9+1 program and is not edited here. Refunds that give stamps back are handled from the order page.</p>
    <h2>Find a customer card</h2>
    <form method="get" className="catalog-filters" role="search"><label>Email or card number (guest cards included)<input name="q" maxLength={254} defaultValue={q}/></label><button className="outline">Search</button></form>
    {q && !found.length && <p>No rewards card found.</p>}
    {found.map((account, i) => <section className="admin-form" key={account.id}>
      <h2>{account.name} · {account.member_code}</h2><p>{account.email} · <strong>{account.balance} stamp(s)</strong> · {account.lifetime_earned} earned in total · {account.status === "active" ? <Badge tone="good">active</Badge> : <Badge tone="bad">{account.status}</Badge>}</p>
      <form action={adjust.bind(null, lang)} className="admin-cols"><input type="hidden" name="account" value={account.id}/><input type="hidden" name="q" value={q}/><input type="hidden" name="key" value={`adjust-${randomUUID()}`}/>
        <label>Stamps to add or remove (e.g. 1 or -1)<input name="points" required pattern="-?\d{1,6}" inputMode="numeric"/></label>
        <label>Reason (kept in the history)<input name="reason" required minLength={3} maxLength={300}/></label>
        <div style={{ alignSelf: "end" }}><Submit className="outline" confirm="Adjust this customer’s stamps? The change is permanent and recorded under your name.">Adjust stamps</Submit></div></form>
      <form action={setAccountStatus.bind(null, lang)}><input type="hidden" name="account" value={account.id}/><input type="hidden" name="q" value={q}/>
        <Submit className={account.status === "active" ? "danger" : "outline"} name="status" value={account.status === "active" ? "suspended" : "active"}
          confirm={account.status === "active" ? "Suspend this card? The customer cannot earn or redeem until you reactivate it." : undefined}>{account.status === "active" ? "Suspend this card" : "Reactivate this card"}</Submit></form>
      <ul>{histories[i].map(h => <li key={h.id}>{when(h.created_at)} · {h.kind} · {h.points > 0 ? "+" : ""}{h.points} → {h.balance_after}{h.reward_name ? ` · ${h.reward_name}` : ""}{h.reason ? ` · ${h.reason}` : ""}{h.order_number ? ` · order #${h.order_number}` : ""} · <small>{h.actor}</small></li>)}</ul>
    </section>)}
    <h2>Latest free drinks redeemed</h2>
    {!recent.length ? <p>None yet.</p> : <ul>{recent.map((r, i) => <li key={i}>{when(r.created_at)} · card {r.member_code} · {r.reward_name} · by {r.actor}</li>)}</ul>}
  </section>;
}
