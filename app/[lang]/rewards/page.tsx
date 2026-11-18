import { notFound } from "next/navigation";
import { RewardsPage, rewardsMetadata } from "../../../src/rewards-page";

// This localized path exists in one language only; the other language answers 404.
export async function generateMetadata() { return rewardsMetadata("en"); }
export default async function Page({ params }: PageProps<"/[lang]/rewards">) {
  const { lang } = await params;
  if (lang !== "en") notFound();
  return <RewardsPage lang="en"/>;
}
