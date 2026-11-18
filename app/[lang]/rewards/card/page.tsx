import { notFound } from "next/navigation";
import { GuestCardPage, cardMetadata } from "../../../../src/guest-card-page";

export function generateMetadata() { return cardMetadata("en"); }
export default async function Page({ params, searchParams }: PageProps<"/[lang]/rewards/card">) {
  const { lang } = await params;
  if (lang !== "en") notFound();
  const query = await searchParams;
  const str = (key: string) => typeof query[key] === "string" ? query[key] as string : undefined;
  return <GuestCardPage lang="en" error={str("error")} notice={str("created") ?? str("restored") ?? str("forgotten")}/>;
}
