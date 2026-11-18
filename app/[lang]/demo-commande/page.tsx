import { notFound } from "next/navigation";
import { OrderRewardsDemo } from "../../../src/order-rewards-demo";
export const metadata = { title: "Commande démo | Salut Bon Bon Thé", robots: { index: false, follow: false } };
export default async function Page({ params }: PageProps<"/[lang]/demo-commande">) { const { lang } = await params; if (lang !== "fr") notFound(); return <OrderRewardsDemo lang="fr"/>; }
