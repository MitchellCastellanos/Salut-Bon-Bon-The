import { redirect } from "next/navigation";

/** Replaced by /admin/menu: prices are edited with each drink. */
export default async function Moved({ params }: PageProps<"/[lang]/admin/prices">) {
  redirect(`/${(await params).lang}/admin/menu`);
}
