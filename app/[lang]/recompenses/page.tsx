import { notFound } from "next/navigation";
import { RewardsPage, rewardsMetadata } from "../../../src/rewards-page";

// This localized path exists in one language only; the other language answers 404.
export async function generateMetadata() { return rewardsMetadata("fr"); }
export default async function Page({ params }: PageProps<"/[lang]/recompenses">) {
  const { lang } = await params;
  if (lang !== "fr") notFound();
  return <RewardsPage lang="fr"/>;
}
