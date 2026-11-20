import { Submit } from "../submit";
import { dollars } from "../ui";

export type DrinkValues = { id?: string; fr?: string; en?: string; category?: string; image?: string | null; featured?: number | null; published?: boolean; available?: boolean;
  regular?: number | null; large?: number | null; regularPromo?: number | null; largePromo?: number | null };

/** Shared by "Add a drink" and "Edit a drink": names in both languages, photo, prices, and whether customers can order it. */
export function DrinkForm({ action, values = {}, categories, images, creating }: {
  action: (form: FormData) => void | Promise<void>; values?: DrinkValues; categories: { id: string; en: string }[]; images: string[]; creating?: boolean;
}) {
  const priceField = (name: string, label: string, cents: number | null | undefined, hint?: string) =>
    <label>{label}<input name={name} inputMode="decimal" pattern="\d{1,3}(\.\d{1,2})?" placeholder="e.g. 6.75" defaultValue={dollars(cents ?? null)}/>{hint && <span className="hint">{hint}</span>}</label>;
  const current = values.image ?? "";
  const options = current && !images.includes(current) ? [current, ...images] : images;
  return <form action={action} className="admin-form">
    {values.id && <input type="hidden" name="id" value={values.id}/>}
    <h2>Name and category</h2>
    <div className="admin-cols">
      <label>Name shown on the English site<input name="en" required maxLength={150} defaultValue={values.en}/></label>
      <label>Name shown on the French site<input name="fr" required maxLength={150} defaultValue={values.fr}/></label>
      <label>Category<select name="category" required defaultValue={values.category ?? categories[0]?.id}>{categories.map(c => <option key={c.id} value={c.id}>{c.en}</option>)}</select></label>
    </div>
    <h2>Photo</h2>
    {options.length ? <label>Photo<select name="image" defaultValue={current}><option value="">No photo</option>{options.map(path => <option key={path} value={path}>{path.split("/").pop()}</option>)}</select>
      <span className="hint">Choose from the photos already on your website. To add a new photo, send it to your web team: once published it appears in this list.</span></label>
      : <label>Photo path<input name="image" defaultValue={current} placeholder="/catalog/NAME.webp"/></label>}
    <h2>Prices</h2>
    <p className="admin-hint">Prices are in Canadian dollars. Saving a price approves it for sale. Leave a size empty if you do not sell it. A sale price must be lower than the regular price.</p>
    <div className="admin-cols">
      {priceField("regular", "Regular size ($)", values.regular)}
      {priceField("large", "Large size ($)", values.large)}
      {!creating && priceField("regularPromo", "Regular sale price ($)", values.regularPromo, "Optional")}
      {!creating && priceField("largePromo", "Large sale price ($)", values.largePromo, "Optional")}
    </div>
    <h2>Visibility</h2>
    {creating ? <label><input type="checkbox" name="available"/> Put it on the menu and allow ordering now</label> : <>
      <label><input type="checkbox" name="published" defaultChecked={values.published}/> Show on the website (untick to hide it completely)</label>
      <label><input type="checkbox" name="available" defaultChecked={values.available}/> Available to order (untick when it is sold out)</label></>}
    {!creating && <label>Homepage featured position<input name="featured" type="number" min={1} max={99} defaultValue={values.featured ?? ""}/><span className="hint">Leave empty to keep it off the homepage. 1 appears first.</span></label>}
    {creating && <p className="admin-hint">Leave this unticked to keep the drink hidden as a draft. A new drink starts with the same toppings as the other drinks in its category. You can change them on the next screen.</p>}
    <div><Submit>{creating ? "Add this drink" : "Save changes"}</Submit></div>
  </form>;
}
