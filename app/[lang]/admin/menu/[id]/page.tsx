import Link from "next/link";
import { notFound } from "next/navigation";
import { listMenu, statusOf } from "../../../../../src/admin-menu";
import { availableImages } from "../../../../../src/admin-images";
import { database } from "../../../../../src/db";
import { adminPage } from "../../guard";
import { Badge, LiveNote, Notice, PageHeader } from "../../ui";
import { Submit } from "../../submit";
import { DrinkForm } from "../drink-form";
import { saveDrink, saveDrinkToppings, toggleAvailability } from "../actions";

export const metadata = { robots: { index: false, follow: false } };
const groupNames: Record<string, string> = { tapioca: "Tapioca", popping: "Popping pearls", jelly: "Jellies", "brown-sugar": "Brown sugar" };

export default async function EditDrink({ params, searchParams }: PageProps<"/[lang]/admin/menu/[id]">) {
  const { lang: rawLang, id } = await params;
  const lang = await adminPage(rawLang);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) notFound();
  const query = await searchParams;
  const db = await database();
  const [menu, images, { rows: categories }, { rows: modifiers }, { rows: assigned }] = await Promise.all([
    listMenu(), availableImages(), db.query<{ id: string; en: string }>("SELECT id, en FROM catalog_categories ORDER BY id"),
    db.query<{ id: string; group_id: string; en: string; available: boolean; surcharge_cents: number | null }>("SELECT id, group_id, en, available, surcharge_cents FROM catalog_modifiers ORDER BY group_id, en"),
    db.query<{ group_id: string; min: number; max: number; modifier_id: string | null; selected: boolean | null }>(`
      SELECT g.group_id, g.min_selections AS min, g.max_selections AS max, a.modifier_id, a.selected_by_default AS selected
      FROM catalog_product_modifier_groups g LEFT JOIN catalog_product_modifiers a ON (a.product_id, a.group_id) = (g.product_id, g.group_id) WHERE g.product_id = $1`, [id]),
  ]);
  const drink = menu.find(row => row.id === id);
  if (!drink) notFound();
  const st = statusOf(drink);
  const groups = [...new Set(modifiers.map(row => row.group_id))];
  return <section className="wrap">
    <p><Link href={`/${lang}/admin/menu`}>← Drinks and prices</Link></p>
    <PageHeader title={drink.en} intro={<>{drink.fr} · <Badge tone={st === "sellable" ? "good" : st === "hidden" ? "neutral" : st === "unpriced" ? "bad" : "warn"}>{st === "sellable" ? "On sale" : st === "hidden" ? "Hidden from website" : st === "soldout" ? "Sold out" : st === "sample" ? "Sample price" : "No price"}</Badge></>}
      action={<><Link className="outline" href={`/${lang}/catalog/products/${id}`}>View on the website</Link><Link className="outline" href={`/${lang}/admin/activity?subject=${id}`}>Change history</Link></>}/>
    <Notice saved={query.saved} error={query.error}
      saves={{ onsale: "Drink is back on sale.", soldout: "Drink marked sold out. The website shows it as unavailable.", created: "Drink added. Choose its toppings below if needed.", drink: "Drink saved. The website and checkout use the new values now.", toppings: "Toppings saved." }}
      errors={{ INVALID: "Check the names, photo and prices (e.g. 6.75). A sale price must be lower than the regular price.", LIMITS: "Check the topping limits: the minimum cannot exceed the maximum, the maximum cannot exceed the toppings offered, and every drink needs at least one tapioca or popping pearl.", NOT_FOUND: "That drink no longer exists." }}/>
    <LiveNote/>
    <DrinkForm action={saveDrink.bind(null, lang)} values={{ ...drink, image: drink.image }} categories={categories} images={images}/>
    <h2>Toppings and customization</h2>
    <p className="admin-hint">Every drink includes one topping chosen from tapioca or popping pearls; every other topping costs its own extra price (set under Categories and toppings). Tick the toppings this drink offers.</p>
    {groups.map(group => {
      const rows = assigned.filter(row => row.group_id === group);
      const on = new Set(rows.filter(row => row.modifier_id).map(row => row.modifier_id));
      const defaults = new Set(rows.filter(row => row.selected).map(row => row.modifier_id));
      const meta = rows[0];
      return <form key={group} action={saveDrinkToppings.bind(null, lang)} className="admin-form">
        <input type="hidden" name="product" value={id}/><input type="hidden" name="group" value={group}/>
        <h2>{groupNames[group] ?? group}</h2>
        <fieldset className="admin-checks" aria-label={`${groupNames[group] ?? group} offered`}>
          {modifiers.filter(row => row.group_id === group).map(row => <label key={row.id}>
            <input type="checkbox" name="eligible" value={row.id} defaultChecked={on.has(row.id)}/> {row.en}{!row.available && <Badge tone="warn">turned off</Badge>}</label>)}
        </fieldset>
        <details><summary>Preselected toppings</summary>
          <div className="admin-checks">{modifiers.filter(row => row.group_id === group).map(row => <label key={row.id}><input type="checkbox" name="defaults" value={row.id} defaultChecked={defaults.has(row.id)}/> {row.en}</label>)}</div></details>
        <div className="admin-cols">
          <label>Minimum the customer must pick<input name="min" type="number" min={0} max={18} required defaultValue={meta?.min ?? 0}/></label>
          <label>Maximum the customer may pick<input name="max" type="number" min={0} max={18} required defaultValue={meta?.max ?? 0}/></label>
        </div>
        <div><Submit className="outline">Save {groupNames[group]?.toLowerCase() ?? group}</Submit></div>
      </form>;
    })}
    <h2>Sold out?</h2>
    <form action={toggleAvailability.bind(null, lang)} className="admin-form"><input type="hidden" name="id" value={id}/><input type="hidden" name="back" value="drink"/><input type="hidden" name="available" value={drink.available ? "0" : "1"}/>
      <p>{drink.available ? "This drink can be ordered. Mark it sold out when you run out: it stays on the website but shows as unavailable." : "This drink is marked sold out: customers cannot order it."}</p>
      <div><Submit className={drink.available ? "danger" : "button"} confirm={drink.available ? `Mark “${drink.en}” sold out? Customers cannot order it until you put it back on sale.` : undefined}>{drink.available ? "Mark sold out" : "Back on sale"}</Submit></div></form>
  </section>;
}
