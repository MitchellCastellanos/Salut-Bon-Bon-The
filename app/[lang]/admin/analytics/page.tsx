import { redirect } from "next/navigation";

/** Replaced by /admin/reports (sales, products, loyalty and website visits). */
export default async function Moved({ params }: PageProps<"/[lang]/admin/analytics">) {
  redirect(`/${(await params).lang}/admin/reports`);
}
