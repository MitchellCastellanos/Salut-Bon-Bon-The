import Link from "next/link";
import { listMenu, menuWarnings, statusOf, type MenuStatus } from "../../../../src/admin-menu";
import { database } from "../../../../src/db";
import { adminPage } from "../guard";
import { Badge, LiveNote, Notice, PageHeader, Stat, money } from "../ui";
import { Submit } from "../submit";
import { toggleAvailability } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const statuses: { id: MenuStatus; label: string }[] = [{ id: "sellable", label: "On sale" }, { id: "soldout", label: "Sold out" }, { id: "hidden", label: "Hidden from website" }, { id: "unpriced", label: "No price" }, { id: "sample", label: "Sample price" }];
const tone = { sellable: "good", soldout: "warn", hidden: "neutral", unpriced: "bad", sample: "warn" } as const;

export default async function AdminMenu({ params, searchParams }: PageProps<"/[lang]/admin/menu">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const str = (key: string) => typeof query[key] === "string" ? (query[key] as string).trim().slice(0, 60) : "";
  const status = statuses.some(item => item.id === str("status")) ? str("status") as MenuStatus : "";
  const [rows, all, warnings, { rows: categories }] = await Promise.all([
    listMenu({ q: str("q"), category: str("category"), status }), listMenu(), menuWarnings(),
    (await database()).query<{ id: string; en: string }>("SELECT id, en FROM catalog_categories ORDER BY id"),
  ]);
  const price = (cents: number | null, promo: number | null) => cents === null ? "not sold" : promo ? `${money(promo)} (was ${money(cents)})` : money(cents);
  return <section className="wrap">
    <PageHeader title="Drinks and prices" intro="Everything customers can order. Change a price, mark a drink sold out or add a new one. This is the only place prices are edited."
      action={<Link className="button" href={`/${lang}/admin/menu/new`}>Add a drink</Link>}/>
    <Notice saved={query.saved} error={query.error} saves={{ onsale: "Drink is back on sale.", soldout: "Drink marked sold out. The website shows it as unavailable and it cannot be ordered." }}
      errors={{ NOT_FOUND: "That drink no longer exists.", FAILED: "Something went wrong. Nothing was changed." }}/>
    <div className="stats">
      <Stat label="On sale" value={warnings.offered} note="shown with an approved price"/>
      <Stat label="Sold out" value={warnings.soldout} href={`/${lang}/admin/menu?status=soldout`}/>
      <Stat label="Hidden from website" value={warnings.hidden} href={`/${lang}/admin/menu?status=hidden`}/>
      <Stat label="No price" value={warnings.unpriced} note={warnings.unpriced ? "customers cannot order these" : "all good"} href={`/${lang}/admin/menu?status=unpriced`}/>
      <Stat label="Sample prices" value={warnings.sample} note={warnings.sample ? "confirm before real sales" : "all confirmed"} href={`/${lang}/admin/menu?status=sample`}/>
    </div>
    <LiveNote>Sold out, hidden and price changes are applied on the website and at checkout immediately. Checkout always uses the price saved here.</LiveNote>
    <form className="catalog-filters" role="search" aria-label="Filter drinks">
      <label>Search<input name="q" maxLength={60} defaultValue={str("q")} placeholder="Name or code"/></label>
      <label>Category<select name="category" defaultValue={str("category")}><option value="">All</option>{categories.map(c => <option key={c.id} value={c.id}>{c.en}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={status}><option value="">All</option>{statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
      <button className="outline">Filter</button>
    </form>
    {!rows.length ? <p>{all.length ? "No drink matches these filters." : "The menu is empty. Add your first drink."}</p> : <ul className="admin-list">
      {rows.map((row, i) => { const st = statusOf(row); return <li key={row.id} className="admin-row">
        <div>
          {(i === 0 || rows[i - 1].category !== row.category) && <small className="admin-hint">{row.categoryName}</small>}
          <h3><Link href={`/${lang}/admin/menu/${row.id}`}>{row.en}</Link> <Badge tone={tone[st]}>{statuses.find(s => s.id === st)?.label}</Badge></h3>
          <p>{row.fr} · Regular {price(row.regular, row.regularPromo)} · Large {price(row.large, row.largePromo)}</p>
        </div>
        <div className="admin-row-actions">
          <form action={toggleAvailability.bind(null, lang)}><input type="hidden" name="id" value={row.id}/><input type="hidden" name="available" value={row.available ? "0" : "1"}/>
            <Submit className="outline" confirm={row.available ? `Mark “${row.en}” sold out? Customers will see it as unavailable and cannot order it.` : undefined}>{row.available ? "Mark sold out" : "Back on sale"}</Submit></form>
          <Link className="outline" href={`/${lang}/admin/menu/${row.id}`}>Edit</Link>
        </div>
      </li>; })}
    </ul>}
  </section>;
}
