import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { officialPrices } from "../../../../src/catalog-pricing";
import { language, money } from "../../../../src/domain";
import { getFiscalSettings } from "../../../../src/business";
import { staffRole } from "../../../../src/staff";
import { submitCounterOrder } from "./actions";
import { CounterForm, type CounterProduct } from "./counter-form";

export const metadata = { robots: { index: false, follow: false } };
const errors: Record<string, [string, string]> = {
  invalid: ["Commande invalide. Vérifiez les boissons et options.", "Invalid order. Check the drinks and options."],
  menu: ["Une boisson ou une option n’est pas offerte (prix non approuvé ou indisponible).", "A drink or option is not offered (unapproved price or unavailable)."],
  member: ["Aucun client Récompenses ne correspond à ce code ou courriel.", "No Rewards customer matches this code or email."],
  fiscal: ["Le statut fiscal n’est pas configuré : l’administration doit le choisir dans Commerce et fiscalité.", "The tax status is not configured: an administrator must choose it in Business and tax."],
  conflict: ["Cette commande a déjà été enregistrée.", "This order was already recorded."],
  rate: ["Trop d’opérations. Patientez une minute.", "Too many operations. Wait a minute."],
};

export default async function CounterPage({ params, searchParams }: PageProps<"/[lang]/staff/counter">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || !await staffRole()) notFound();
  const fr = lang === "fr";
  const query = await searchParams;
  const flag = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const [prices, fiscal] = await Promise.all([officialPrices(true), getFiscalSettings()]);
  const products: CounterProduct[] = [...new Set(prices.map(row => row.id))].map(id => {
    const rows = prices.filter(row => row.id === id);
    return {
      id, name: fr ? rows[0].fr : rows[0].en, prices: Object.fromEntries(rows.map(row => [row.size, row.cents])),
      groups: rows[0].groups.map(group => ({ id: group.id, min: group.min, max: group.max, options: group.options.map(option => ({ id: option.id, label: fr ? option.fr : option.en, cents: option.cents, default: option.default })) })),
    };
  });
  const error = errors[flag("error")];
  return <section className="wrap section">
    <Link href={`/${lang}/staff`}>{fr ? "Commandes" : "Orders"}</Link>
    <h1>{fr ? "Vente au comptoir" : "Counter sale"}<span>.</span></h1>
    <p>{fr ? "Enregistrez une vente faite en personne. Les prix et taxes sont calculés par le serveur ; la vente est enregistrée comme payée et terminée." : "Record a sale made in person. Prices and tax are calculated by the server; the sale is saved as paid and completed."}</p>
    {flag("done") && <p role="status" className="panel">{fr ? `Vente #${flag("done")} enregistrée : ${money(Number(flag("total")), lang)}.` : `Sale #${flag("done")} recorded: ${money(Number(flag("total")), lang)}.`}{Number(flag("points")) > 0 && (fr ? ` ${flag("points")} tampons accordés.` : ` ${flag("points")} stamps awarded.`)}</p>}
    {error && <p role="alert" className="panel">{error[fr ? 0 : 1]}</p>}
    {fiscal.status === "unconfigured" && <p role="alert" className="panel">{errors.fiscal[fr ? 0 : 1]}</p>}
    {!products.length ? <p role="status">{fr ? "Aucune boisson n’a de prix approuvé et offert. Voir la feuille de prix." : "No drink has an approved, offered price. See the price sheet."}</p> :
      <CounterForm key={flag("done") || "new"} lang={lang} products={products} request={randomUUID()} action={submitCounterOrder.bind(null, lang)}/>}
  </section>;
}
