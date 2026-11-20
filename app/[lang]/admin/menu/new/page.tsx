import Link from "next/link";
import { availableImages } from "../../../../../src/admin-images";
import { database } from "../../../../../src/db";
import { adminPage } from "../../guard";
import { Notice, PageHeader } from "../../ui";
import { DrinkForm } from "../drink-form";
import { createDrink } from "../actions";

export const metadata = { robots: { index: false, follow: false } };

export default async function NewDrink({ params, searchParams }: PageProps<"/[lang]/admin/menu/new">) {
  const lang = await adminPage((await params).lang);
  const query = await searchParams;
  const [{ rows: categories }, images] = await Promise.all([(await database()).query<{ id: string; en: string }>("SELECT id, en FROM catalog_categories ORDER BY id"), availableImages()]);
  return <section className="wrap">
    <p><Link href={`/${lang}/admin/menu`}>← Drinks and prices</Link></p>
    <PageHeader title="Add a drink" intro="Give it a name in both languages, a category and a price. You can leave it hidden until you are ready."/>
    <Notice error={query.error} errors={{ EXISTS: "A drink with this name already exists.", INVALID: "Check the names, category and prices (e.g. 6.75). A sale price must be lower than the regular price." }}/>
    <DrinkForm creating action={createDrink.bind(null, lang)} categories={categories} images={images}/>
  </section>;
}
