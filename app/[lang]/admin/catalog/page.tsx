import { AdminNav } from "../nav";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";
import { editCatalog, editEligibility } from "./actions";

type Named = { id: string; fr: string; en: string };
export const metadata = { robots: { index: false, follow: false } };

function Labels({ row }: { row: Named }) {
  return <>
    <input type="hidden" name="id" value={row.id}/>
    <label>FR <input name="fr" required maxLength={150} defaultValue={row.fr}/></label>
    <label>EN <input name="en" required maxLength={150} defaultValue={row.en}/></label>
  </>;
}

export default async function EditCatalogPage({ params }: PageProps<"/[lang]/admin/catalog">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const db = await database();
  const [categories, products, modifiers, collections, assignments] = await Promise.all([
    db.query<Named>("SELECT id, fr, en FROM catalog_categories ORDER BY id"),
    db.query<Named & { category: string; image: string | null; featured: number | null }>(`
      SELECT p.id, p.category, fr.name AS fr, en.name AS en, i.path AS image, f.position AS featured
      FROM catalog_products p
      JOIN catalog_product_translations fr ON fr.product_id = p.id AND fr.locale = 'fr'
      JOIN catalog_product_translations en ON en.product_id = p.id AND en.locale = 'en'
      LEFT JOIN LATERAL (SELECT path FROM catalog_product_images WHERE product_id = p.id ORDER BY position, path LIMIT 1) i ON true
      LEFT JOIN catalog_featured_placements f ON f.product_id = p.id AND f.placement = 'homepage'
      ORDER BY p.id
    `),
    db.query<Named & { surcharge_cents: number | null; available: boolean; group_id: string }>(
      "SELECT id, fr, en, surcharge_cents, available, group_id FROM catalog_modifiers ORDER BY group_id, id"
    ),
    db.query<Named & { products: string | null }>(`
      SELECT l.*, string_agg(m.product_id, ',' ORDER BY m.position) AS products
      FROM catalog_collections l LEFT JOIN catalog_collection_products m ON m.collection_id = l.id
      GROUP BY l.id ORDER BY l.id
    `),
    db.query<{ product_id: string; group_id: string; min: number; max: number; eligible: string | null; defaults: string | null }>(`
      SELECT g.product_id, g.group_id, g.min_selections AS min, g.max_selections AS max,
        string_agg(a.modifier_id, ',' ORDER BY a.modifier_id) AS eligible,
        string_agg(a.modifier_id, ',' ORDER BY a.modifier_id) FILTER (WHERE a.selected_by_default) AS defaults
      FROM catalog_product_modifier_groups g LEFT JOIN catalog_product_modifiers a
        ON (a.product_id, a.group_id) = (g.product_id, g.group_id)
      GROUP BY g.product_id, g.group_id
    `),
  ]);
  const groups = [...new Set(modifiers.rows.map(row => row.group_id))];
  const save = <button className="outline">{fr ? "Enregistrer" : "Save"}</button>;
  return <section className="wrap catalog-page">
    <AdminNav lang={lang} current="catalog"/>
    <h1>{fr ? "Modifier le catalogue" : "Edit the catalog"}</h1>
    <details className="panel"><summary>{fr ? "Catégories" : "Categories"}</summary>
      {categories.rows.map(row => <form key={row.id} action={editCatalog} className="catalog-filters">
        <input type="hidden" name="type" value="category"/><strong>{row.id}</strong><Labels row={row}/>{save}
      </form>)}
    </details>
    <details className="panel"><summary>Collections</summary>
      {collections.rows.map(row => <form key={row.id} action={editCatalog} className="catalog-filters">
        <input type="hidden" name="type" value="collection"/><strong>{row.id}</strong><Labels row={row}/>
        <label>{fr ? "Identifiants des produits, séparés par virgules" : "Comma-separated product IDs"}
          <input name="products" defaultValue={row.products ?? ""} maxLength={3000}/>
        </label>{save}
      </form>)}
    </details>
    <details className="panel"><summary>{fr ? "Garnitures et gelées" : "Toppings and jellies"}</summary>
      {modifiers.rows.map(row => <form key={row.id} action={editCatalog} className="catalog-filters">
        <input type="hidden" name="type" value="modifier"/><strong>{row.id}</strong><Labels row={row}/>
        <label>{fr ? "Supplément (cents)" : "Surcharge (cents)"}<input type="number" name="cents" min="0" max="100000" defaultValue={row.surcharge_cents ?? ""}/></label>
        <label><input type="checkbox" name="available" defaultChecked={row.available}/> {fr ? "Disponible" : "Available"}</label>{save}
      </form>)}
    </details>
    <details className="panel"><summary>{fr ? "Produits" : "Products"}</summary>
      {products.rows.map(row => <details key={row.id}>
        <summary>{row.id} · {row[lang]}</summary>
        <form action={editCatalog} className="catalog-filters">
          <input type="hidden" name="type" value="product"/><Labels row={row}/>
          <label>{fr ? "Catégorie" : "Category"}<select name="category" defaultValue={row.category}>
            {categories.rows.map(category => <option value={category.id} key={category.id}>{category[lang]}</option>)}
          </select></label>
          <label>{fr ? "Chemin WebP public" : "Public WebP path"}<input name="image" defaultValue={row.image ?? ""}/></label>
          <label>{fr ? "Position vedette" : "Featured position"}<input type="number" name="featured" min="1" max="99" defaultValue={row.featured ?? ""}/></label>{save}
        </form>
        {groups.map(group => {
          const assigned = assignments.rows.find(item => item.product_id === row.id && item.group_id === group);
          const choices = modifiers.rows.filter(item => item.group_id === group).map(item => item.id).join(", ");
          return <form key={group} action={editEligibility} className="catalog-filters">
            <input type="hidden" name="product" value={row.id}/><input type="hidden" name="group" value={group}/><strong>{group}</strong>
            <label>Min <input type="number" required name="min" min="0" max="18" defaultValue={assigned?.min ?? 0}/></label>
            <label>Max <input type="number" required name="max" min="0" max="18" defaultValue={assigned?.max ?? 0}/></label>
            <label>{fr ? "Admissibles (identifiants séparés par virgules)" : "Eligible (comma-separated IDs)"}<input name="eligible" defaultValue={assigned?.eligible ?? ""} title={choices}/></label>
            <label>{fr ? "Par défaut (identifiants)" : "Defaults (IDs)"}<input name="defaults" defaultValue={assigned?.defaults ?? ""}/></label>{save}
          </form>;
        })}
      </details>)}
    </details>
  </section>;
}
