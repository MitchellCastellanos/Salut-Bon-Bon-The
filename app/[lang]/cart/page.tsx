import Link from "next/link";
import { notFound } from "next/navigation";
import { language } from "../../../src/domain";
import { OrderExperience } from "../catalog/order-experience";
export default async function CartPage({ params }: PageProps<"/[lang]/cart">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  return <section className="wrap catalog-page">
    <Link className="outline" href={`/${lang}/catalog`}>← {lang === "fr" ? "Continuer les achats" : "Continue shopping"}</Link>
    <h1>{lang === "fr" ? "Ton panier" : "Your cart"}</h1>
    <OrderExperience lang={lang} mode="cart"/>
  </section>;
}
