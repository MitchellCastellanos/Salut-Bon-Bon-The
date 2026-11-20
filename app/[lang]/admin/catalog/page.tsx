import { redirect } from "next/navigation";

/** Replaced by /admin/menu (drinks, prices and toppings in one place). */
export default async function Moved({ params }: PageProps<"/[lang]/admin/catalog">) {
  redirect(`/${(await params).lang}/admin/menu`);
}
