import Link from "next/link";
import { notFound } from "next/navigation";
import { database } from "../../../../src/db";
import { language } from "../../../../src/domain";
import { staffRole } from "../../../../src/staff";
import { savePriceSheet } from "./actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPrices({ params, searchParams }: PageProps<"/[lang]/admin/prices">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const { saved, error } = await searchParams;
  const { rows } = await (await database()).query<{ id: string; category: string; name: string; available: boolean; regular: number | null; large: number | null }>(`
    SELECT p.id, c.${fr ? "fr" : "en"} AS category, t.name, p.available,
      (SELECT price_cents FROM catalog_variants WHERE product_id = p.id AND id = 'regular' AND approved) AS regular,
      (SELECT price_cents FROM catalog_variants WHERE product_id = p.id AND id = 'large' AND approved) AS large
    FROM catalog_products p JOIN catalog_categories c ON c.id = p.category
    JOIN catalog_product_translations t ON t.product_id = p.id AND t.locale = $1
    ORDER BY c.id, p.id`, [lang]);
  const dollars = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);
  const priced = rows.filter(row => row.regular !== null || row.large !== null).length;
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/admin`}>{fr ? "Administration" : "Administration"}</Link>
    <h1>{fr ? "Feuille de prix" : "Price sheet"}</h1>
    <p>{fr ? `Saisissez les prix approuvés en dollars (ex. 6.75). Laissez vide un format non vendu. ${priced} des ${rows.length} produits ont un prix.` : `Enter the approved prices in dollars (e.g. 6.75). Leave a size blank if it is not sold. ${priced} of ${rows.length} products have a price.`}</p>
    {saved && <p role="status" className="panel">{fr ? "Prix enregistrés." : "Prices saved."}</p>}
    {error && <p role="alert" className="panel">{error === "confirm" ? (fr ? "Cochez la confirmation d’approbation." : "Tick the approval confirmation.") : (fr ? "Un prix est invalide." : "A price is invalid.")}</p>}
    <form action={savePriceSheet.bind(null, lang)}>
      <table className="price-table"><thead><tr><th>{fr ? "Code" : "Code"}</th><th>{fr ? "Produit" : "Product"}</th><th>{fr ? "Régulier ($)" : "Regular ($)"}</th><th>{fr ? "Grand ($)" : "Large ($)"}</th><th>{fr ? "Offert" : "Offered"}</th></tr></thead>
        <tbody>{rows.map((row, i) => <>
          {(i === 0 || rows[i - 1].category !== row.category) && <tr key={`c-${row.category}`}><th colSpan={5} scope="colgroup">{row.category}</th></tr>}
          <tr key={row.id}><td>{row.id}</td><td>{row.name}</td>
            <td><input name={`price_${row.id}_regular`} inputMode="decimal" pattern="\d{1,3}(\.\d{1,2})?" defaultValue={dollars(row.regular)} aria-label={`${row.name} ${fr ? "régulier" : "regular"}`}/></td>
            <td><input name={`price_${row.id}_large`} inputMode="decimal" pattern="\d{1,3}(\.\d{1,2})?" defaultValue={dollars(row.large)} aria-label={`${row.name} ${fr ? "grand" : "large"}`}/></td>
            <td><input type="checkbox" name={`avail_${row.id}`} defaultChecked={row.available} aria-label={`${row.name} ${fr ? "offert" : "offered"}`}/></td></tr></>)}</tbody></table>
      <label className="panel"><input type="checkbox" name="confirm"/> {fr ? "Je confirme que ces prix sont approuvés par le propriétaire." : "I confirm these prices are approved by the owner."}</label>
      <button className="button">{fr ? "Enregistrer tous les prix" : "Save all prices"}</button>
    </form>
  </section>;
}
