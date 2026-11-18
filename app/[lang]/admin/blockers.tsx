import Link from "next/link";
import type { Blocker } from "../../../src/business";

const text: Record<Blocker, [string, string, string]> = {
  FLAG_OFF: ["Le commutateur « commandes pour cueillette » est éteint.", "The “pickup ordering” switch is off.", "hours"],
  NO_SCHEDULE: ["Aucun horaire hebdomadaire n’est enregistré.", "No weekly schedule is saved.", "hours"],
  NO_LEAD_TIME: ["Le délai de préparation n’est pas défini.", "The preparation lead time is not set.", "hours"],
  NO_CAPACITY: ["La capacité par plage n’est pas définie.", "The per-slot capacity is not set.", "hours"],
  NO_FISCAL_STATUS: ["Le statut fiscal (inscrit ou non aux taxes) n’est pas choisi.", "The tax status (registered or not) is not chosen.", "business"],
  NO_PROFILE: ["Le profil du commerce (adresse, téléphone) est absent.", "The business profile (address, phone) is missing.", "business"],
  NO_PRICES: ["Aucun produit n’a de prix approuvé.", "No product has an approved price.", "prices"],
};

/** Explains exactly why pickup checkout is closed, with a link to the screen that fixes each item. */
export function BlockerList({ lang, blockers }: { lang: "fr" | "en"; blockers: Blocker[] }) {
  const fr = lang === "fr";
  return <section className="panel" role="status" aria-label={fr ? "Pourquoi la commande est fermée" : "Why ordering is closed"}>
    <strong>{fr ? "La commande en ligne est fermée. Il reste :" : "Online ordering is closed. Still missing:"}</strong>
    <ul>{blockers.map(code => <li key={code}>{text[code][fr ? 0 : 1]} <Link href={`/${lang}/admin/${text[code][2]}`}>{fr ? "Corriger" : "Fix"}</Link></li>)}</ul>
  </section>;
}
