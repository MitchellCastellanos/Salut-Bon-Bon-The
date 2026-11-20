import { redirect } from "next/navigation";

/** Replaced by /admin/website (homepage campaigns and collections). */
export default async function Moved({ params }: PageProps<"/[lang]/admin/campaigns">) {
  redirect(`/${(await params).lang}/admin/website`);
}
