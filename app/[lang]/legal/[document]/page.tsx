import { notFound } from "next/navigation";
import { language } from "../../../../src/domain";

export const metadata = { robots: { index: false, follow: false } };
export default async function LegalPage({ params }: PageProps<"/[lang]/legal/[document]">) {
  const { lang, document } = await params;
  if (!language(lang) || (document !== "privacy" && document !== "terms")) notFound();
  const fr = lang === "fr";
  const privacy = document === "privacy";
  return <article className="wrap section narrow">
    <h1>{privacy ? fr ? "Confidentialité" : "Privacy" : fr ? "Conditions" : "Terms"}</h1>
    <p className="pill">{fr ? "Brouillon à faire réviser" : "Draft pending legal review"}</p>
    {privacy ? <p>{fr ? "La démonstration conserve le nom de cueillette, la commande et les notes fournies. Utilise des renseignements fictifs." : "The demo stores the pickup name, order details and any submitted notes. Use fictitious information."}</p>
      : <p>{fr ? "Le menu, les prix et les heures de cueillette sont des exemples. Les paiements simulés n’entraînent aucun débit." : "The menu, prices and pickup times are examples. Simulated payments do not charge you."}</p>}
  </article>;
}
