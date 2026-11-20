"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { MenuError, createProduct, createTopping, parseDollars, saveCategory, saveProduct, saveToppings, saveTopping, setProductAvailable } from "../../../../src/admin-menu";
import { language } from "../../../../src/domain";
import { adminAction, flag, text } from "../guard";

const done = (lang: string, path: string, query: string): never => { revalidatePath(`/${lang}`, "layout"); return redirect(`/${lang}/admin/menu${path}?${query}`); };
const fail = (lang: string, path: string, error: unknown): never => {
  const code = error instanceof MenuError ? error.code : error instanceof Error && /^(NEXT_REDIRECT)/.test(error.message) ? "" : "FAILED";
  if (!code) throw error;
  return redirect(`/${lang}/admin/menu${path}?error=${code}`);
};
const num = (value: string) => value === "" ? null : /^\d{1,2}$/.test(value) ? Number(value) : (() => { throw new MenuError("INVALID"); })();

/** One-tap sold out / back on sale from the drink list. A sold-out drink stays on the website, marked unavailable, and cannot be ordered. */
export async function toggleAvailability(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  const back = text(form, "back") === "drink" && /^[A-Za-z0-9-]{1,64}$/.test(text(form, "id")) ? `/${text(form, "id")}` : "";
  try { await setProductAvailable(text(form, "id"), form.get("available") === "1", actor); } catch (error) { return fail(lang, back, error); }
  done(lang, back, `saved=${form.get("available") === "1" ? "onsale" : "soldout"}`);
}

export async function createDrink(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  let id = "";
  try {
    id = await createProduct({ fr: text(form, "fr"), en: text(form, "en"), category: text(form, "category"), image: text(form, "image"), available: flag(form, "available"),
      regular: parseDollars(text(form, "regular")), large: parseDollars(text(form, "large")), regularPromo: null, largePromo: null }, actor);
  } catch (error) { return fail(lang, "/new", error); }
  done(lang, `/${id}`, "saved=created");
}

export async function saveDrink(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  const id = text(form, "id");
  try {
    await saveProduct({ id, fr: text(form, "fr"), en: text(form, "en"), category: text(form, "category"), image: text(form, "image"), featured: num(text(form, "featured")),
      published: flag(form, "published"), available: flag(form, "available"), regular: parseDollars(text(form, "regular")), large: parseDollars(text(form, "large")),
      regularPromo: parseDollars(text(form, "regularPromo")), largePromo: parseDollars(text(form, "largePromo")) }, actor);
  } catch (error) { return fail(lang, `/${/^[A-Za-z0-9-]{1,64}$/.test(id) ? id : ""}`, error); }
  done(lang, `/${id}`, "saved=drink");
}

export async function saveDrinkToppings(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  const product = text(form, "product");
  try {
    await saveToppings({ product, group: text(form, "group"), min: Number(text(form, "min") || 0), max: Number(text(form, "max") || 0),
      eligible: form.getAll("eligible").map(String), defaults: form.getAll("defaults").map(String) }, actor);
  } catch (error) { return fail(lang, `/${/^[A-Za-z0-9-]{1,64}$/.test(product) ? product : ""}`, error); }
  done(lang, `/${product}`, "saved=toppings");
}

export async function saveCategoryAction(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  try { await saveCategory({ id: text(form, "id"), fr: text(form, "fr"), en: text(form, "en") }, actor, form.get("create") === "1"); } catch (error) { return fail(lang, "/options", error); }
  done(lang, "/options", "saved=category");
}

export async function saveToppingAction(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  try {
    const cents = parseDollars(text(form, "price"), true);
    if (form.get("create") === "1") await createTopping({ group: text(form, "group"), fr: text(form, "fr"), en: text(form, "en"), cents, available: flag(form, "available") }, actor);
    else await saveTopping({ id: text(form, "id"), fr: text(form, "fr"), en: text(form, "en"), cents, available: flag(form, "available") }, actor);
  } catch (error) { return fail(lang, "/options", error); }
  done(lang, "/options", "saved=topping");
}
