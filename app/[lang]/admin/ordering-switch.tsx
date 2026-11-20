import Link from "next/link";
import type { Blocker } from "../../../src/business";
import { Badge } from "./ui";
import { Submit } from "./submit";
import { setOrdering } from "./store-actions";

const why: Record<Blocker, { text: string; fix: string }> = {
  FLAG_OFF: { text: "New orders are paused.", fix: "hours" },
  NO_SCHEDULE: { text: "No weekly opening hours are saved.", fix: "hours" },
  NO_LEAD_TIME: { text: "The preparation time is not set.", fix: "hours" },
  NO_CAPACITY: { text: "The number of orders per pickup time is not set.", fix: "hours" },
  NO_FISCAL_STATUS: { text: "The tax status is not chosen.", fix: "business" },
  NO_PROFILE: { text: "The business address and phone are missing.", fix: "business" },
  NO_PRICES: { text: "No drink is on sale with a price.", fix: "menu" },
};

/** Business hours say when the shop is open; this says whether the website is taking orders right now. */
export function OrderingSwitch({ lang, flag, blockers, back }: { lang: string; flag: boolean; blockers: Blocker[]; back: "dashboard" | "hours" }) {
  const other = blockers.filter(code => code !== "FLAG_OFF");
  const open = blockers.length === 0;
  return <section className={`panel ${open ? "" : "notice-warn"}`} aria-labelledby="ordering-title" style={{ marginBottom: 18 }}>
    <div className="admin-row" style={{ border: 0, padding: 0, background: "transparent" }}>
      <div>
        <h2 id="ordering-title" style={{ margin: 0, fontSize: "1.25rem" }}>Online ordering <Badge tone={open ? "good" : flag ? "warn" : "bad"}>{open ? "Open" : flag ? "Not ready" : "Paused"}</Badge></h2>
        <p>{open ? "Customers can place pickup orders during your opening hours."
          : flag ? "The switch is on, but customers cannot order yet. Finish the items below."
          : "Customers see that ordering is closed. Counter sales and the live queue keep working."}</p>
        <p className="admin-hint">Opening hours decide <em>when</em> pickups are offered. This switch decides whether the website accepts orders at all, for example when you are overwhelmed or sold out.</p>
      </div>
      <form action={setOrdering.bind(null, lang)} className="admin-row-actions"><input type="hidden" name="back" value={back}/>
        {flag ? <><input type="hidden" name="enabled" value="0"/><Submit className="danger" confirm="Temporarily stop new online orders? Orders already received are not affected.">Temporarily stop new orders</Submit></>
          : <><input type="hidden" name="enabled" value="1"/><Submit>Resume online orders</Submit></>}</form>
    </div>
    {other.length > 0 && <ul>{other.map(code => <li key={code}>{why[code].text} <Link href={`/${lang}/admin/${why[code].fix}`}>Fix</Link></li>)}</ul>}
  </section>;
}
