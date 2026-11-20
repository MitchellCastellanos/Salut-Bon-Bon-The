import { availableImages } from "../../../../src/admin-images";
import { database } from "../../../../src/db";
import { adminPage } from "../guard";
import { LiveNote, Notice, PageHeader } from "../ui";
import { Submit } from "../submit";
import { saveCampaign, saveCollectionAction } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const zone = "America/Toronto";
const day = (value: Date | string | null, offset = 0) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(new Date(value).getTime() + offset)) : "";

export default async function Website({ params, searchParams }: PageProps<"/[lang]/admin/website">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const db = await database();
  const [{ rows: campaigns }, { rows: collections }, { rows: products }, images] = await Promise.all([
    db.query<{ id: string; collection_id: string; published: boolean; active: boolean; starts_at: Date | null; ends_at: Date | null; homepage_position: number | null; headline_fr: string; headline_en: string; seo_fr: string | null; seo_en: string | null; image: string | null }>(`
      SELECT c.*, fr.headline AS headline_fr, en.headline AS headline_en, fr.seo_description AS seo_fr, en.seo_description AS seo_en, a.path AS image
      FROM marketing_campaigns c
      JOIN marketing_campaign_translations fr ON fr.campaign_id = c.id AND fr.locale = 'fr' JOIN marketing_campaign_translations en ON en.campaign_id = c.id AND en.locale = 'en'
      LEFT JOIN LATERAL (SELECT path FROM marketing_campaign_assets WHERE campaign_id = c.id ORDER BY path LIMIT 1) a ON true ORDER BY c.homepage_position, c.id`),
    db.query<{ id: string; fr: string; en: string; products: string[] }>(`
      SELECT l.id, l.fr, l.en, ARRAY(SELECT product_id FROM catalog_collection_products WHERE collection_id = l.id ORDER BY position) AS products FROM catalog_collections l ORDER BY l.id`),
    db.query<{ id: string; en: string }>("SELECT p.id, t.name AS en FROM catalog_products p JOIN catalog_product_translations t ON t.product_id = p.id AND t.locale = 'en' ORDER BY t.name"),
    availableImages(),
  ]);
  const banners = images.filter(path => path.startsWith("/promotions/") || path.startsWith("/drinks/"));
  return <section className="wrap">
    <PageHeader title="Website content" intro="The homepage campaigns and the product collections behind them. Drink names, photos and prices are edited under Drinks and prices."/>
    <Notice saved={query.saved} error={query.error} saves={{ campaign: "Campaign saved. The homepage shows it now.", collection: "Collection saved." }}
      errors={{ campaign: "Check the titles and dates. The end date cannot be before the start date.", INVALID: "Check the collection name and products.", NOT_FOUND: "That collection no longer exists." }}/>
    <LiveNote>A campaign appears on the homepage only while it is published, active and within its dates.</LiveNote>
    <h2>Homepage campaigns</h2>
    {campaigns.map(c => <form key={c.id} action={saveCampaign.bind(null, lang)} className="admin-form">
      <h2>{c.headline_en}</h2><input type="hidden" name="id" value={c.id}/>
      <div className="admin-cols"><label>English headline<input name="headlineEn" required maxLength={200} defaultValue={c.headline_en}/></label><label>French headline<input name="headlineFr" required maxLength={200} defaultValue={c.headline_fr}/></label></div>
      <div className="admin-cols"><label>English search description<input name="seoEn" maxLength={250} defaultValue={c.seo_en ?? ""}/></label><label>French search description<input name="seoFr" maxLength={250} defaultValue={c.seo_fr ?? ""}/></label></div>
      <div className="admin-cols">
        <label>Banner photo<select name="image" defaultValue={c.image ?? ""}><option value="">No photo</option>{[...new Set([...(c.image ? [c.image] : []), ...banners])].map(path => <option key={path} value={path}>{path.split("/").pop()}</option>)}</select></label>
        <label>First day (optional)<input type="date" name="starts" defaultValue={day(c.starts_at)}/></label>
        <label>Last day (optional)<input type="date" name="ends" defaultValue={day(c.ends_at, -1)}/></label>
        <label>Homepage order<input type="number" name="position" min={1} max={99} defaultValue={c.homepage_position ?? ""}/></label>
      </div>
      <label><input type="checkbox" name="published" defaultChecked={c.published}/> Published</label>
      <label><input type="checkbox" name="active" defaultChecked={c.active}/> Active</label>
      <div><Submit>Save campaign</Submit></div>
    </form>)}
    <h2>Collections</h2>
    <p className="admin-hint">A collection is the list of drinks shown on a campaign page. Tick the drinks to include.</p>
    {collections.map(c => <form key={c.id} action={saveCollectionAction.bind(null, lang)} className="admin-form">
      <input type="hidden" name="id" value={c.id}/>
      <div className="admin-cols"><label>English name<input name="en" required maxLength={150} defaultValue={c.en}/></label><label>French name<input name="fr" required maxLength={150} defaultValue={c.fr}/></label></div>
      <details><summary>{c.products.length} drink(s) in this collection</summary>
        <div className="admin-checks">{[...c.products.flatMap(id => products.filter(p => p.id === id)), ...products.filter(p => !c.products.includes(p.id))].map(p => <label key={p.id}><input type="checkbox" name="products" value={p.id} defaultChecked={c.products.includes(p.id)}/> {p.en}</label>)}</div></details>
      <div><Submit className="outline">Save collection</Submit></div>
    </form>)}
  </section>;
}
