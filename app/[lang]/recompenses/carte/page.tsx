import { notFound } from "next/navigation";
import { GuestCardPage, cardMetadata } from "../../../../src/guest-card-page";

export function generateMetadata() { return cardMetadata("fr"); }
export default async function Page({ params, searchParams }: PageProps<"/[lang]/recompenses/carte">) {
  const { lang } = await params;
  if (lang !== "fr") notFound();
  const query = await searchParams;
  const str = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  return <GuestCardPage lang="fr" error={str("error")} notice={str("created") ?? str("restored") ?? str("forgotten")}/>;
}
