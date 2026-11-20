import Link from "next/link";
import { database } from "../../../../../src/db";
import { adminPage } from "../../guard";
import { Badge, LiveNote, Notice, PageHeader, dollars } from "../../ui";
import { Submit } from "../../submit";
import { saveCategoryAction, saveToppingAction } from "../actions";

export const metadata = { robots: { index: false, follow: false } };
const groupNames: Record<string, string> = { tapioca: "Tapioca", popping: "Popping pearls", jelly: "Jellies", "brown-sugar": "Brown sugar" };

export default async function MenuOptions({ params, searchParams }: PageProps<"/[lang]/admin/menu/options">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const db = await database();
  const [{ rows: categories }, { rows: toppings }] = await Promise.all([
    db.query<{ id: string; fr: string; en: string; drinks: number }>("SELECT c.id, c.fr, c.en, (SELECT count(*)::int FROM catalog_products p WHERE p.category = c.id) AS drinks FROM catalog_categories c ORDER BY c.id"),
    db.query<{ id: string; group_id: string; fr: string; en: string; available: boolean; surcharge_cents: number | null }>("SELECT id, group_id, fr, en, available, surcharge_cents FROM catalog_modifiers ORDER BY group_id, en"),
  ]);
  const groups = [...new Set(toppings.map(row => row.group_id))];
  return <section className="wrap">
    <PageHeader title="Categories and toppings" intro="The groups that organize your menu and the toppings customers can add. Which drink offers which topping is set on each drink."
      action={<Link className="outline" href={`/${lang}/admin/menu`}>← Drinks and prices</Link>}/>
    <Notice saved={query.saved} error={query.error} saves={{ category: "Category saved.", topping: "Topping saved. Checkout uses the new price now." }}
      errors={{ EXISTS: "That name already exists.", INVALID: "Check the names and the price (e.g. 1.00).", NOT_FOUND: "That item no longer exists." }}/>
    <LiveNote/>
    <h2>Categories</h2>
    <ul className="admin-list">{categories.map(row => <li key={row.id}>
      <form action={saveCategoryAction.bind(null, lang)} className="admin-form"><input type="hidden" name="id" value={row.id}/>
        <div className="admin-cols"><label>English name<input name="en" required maxLength={150} defaultValue={row.en}/></label><label>French name<input name="fr" required maxLength={150} defaultValue={row.fr}/></label></div>
        <div className="admin-row-actions" style={{ justifyContent: "space-between" }}><span className="admin-hint">{row.drinks} drink(s)</span><Submit className="outline">Save</Submit></div></form></li>)}</ul>
    <form action={saveCategoryAction.bind(null, lang)} className="admin-form"><input type="hidden" name="create" value="1"/><input type="hidden" name="id" value=""/>
      <h2>Add a category</h2><div className="admin-cols"><label>English name<input name="en" required maxLength={150}/></label><label>French name<input name="fr" required maxLength={150}/></label></div>
      <div><Submit>Add category</Submit></div></form>
    <h2>Toppings</h2>
    <p className="admin-hint">Price is the extra charged for the topping, in dollars. A topping with no price, or turned off, cannot be ordered.</p>
    {groups.map(group => <div key={group}><h3>{groupNames[group] ?? group}</h3>
      <ul className="admin-list">{toppings.filter(row => row.group_id === group).map(row => <li key={row.id}>
        <form action={saveToppingAction.bind(null, lang)} className="admin-form"><input type="hidden" name="id" value={row.id}/>
          <div className="admin-cols"><label>English name<input name="en" required maxLength={150} defaultValue={row.en}/></label><label>French name<input name="fr" required maxLength={150} defaultValue={row.fr}/></label>
            <label>Extra price ($)<input name="price" inputMode="decimal" pattern="\d{1,3}(\.\d{1,2})?" defaultValue={dollars(row.surcharge_cents)}/></label></div>
          <label><input type="checkbox" name="available" defaultChecked={row.available}/> Customers can choose it {row.available && row.surcharge_cents !== null ? <Badge tone="good">on</Badge> : <Badge tone="warn">not orderable</Badge>}</label>
          <div><Submit className="outline">Save</Submit></div></form></li>)}</ul>
      <form action={saveToppingAction.bind(null, lang)} className="admin-form"><input type="hidden" name="create" value="1"/><input type="hidden" name="group" value={group}/>
        <h2>Add to {groupNames[group]?.toLowerCase() ?? group}</h2>
        <div className="admin-cols"><label>English name<input name="en" required maxLength={150}/></label><label>French name<input name="fr" required maxLength={150}/></label>
          <label>Extra price ($)<input name="price" inputMode="decimal" pattern="\d{1,3}(\.\d{1,2})?" defaultValue="1.00"/></label></div>
        <label><input type="checkbox" name="available" defaultChecked/> Customers can choose it</label><div><Submit>Add topping</Submit></div></form></div>)}
  </section>;
}
