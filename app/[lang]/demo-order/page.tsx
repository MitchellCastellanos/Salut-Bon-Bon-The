import { notFound } from "next/navigation";
import { OrderRewardsDemo } from "../../../src/order-rewards-demo";
export const metadata = { title: "Order | Salut Bon Bon Thé", robots: { index: false, follow: false } };
export default async function Page({ params }: PageProps<"/[lang]/demo-order">) { const { lang } = await params; if (lang !== "en") notFound(); return <OrderRewardsDemo lang="en"/>; }
