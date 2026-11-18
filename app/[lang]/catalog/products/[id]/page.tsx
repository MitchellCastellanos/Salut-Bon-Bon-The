import Image from "next/image";
import { hasPublicImage } from "../../../../../src/storefront-art";
import { pickupConfiguration } from "../../../../../src/store-settings";
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogProducts } from "../../../../../src/catalog";
import { officialPrices } from "../../../../../src/catalog-pricing";
import { language, modifiers, money } from "../../../../../src/domain";
import { loyaltyProgram, programStages } from "../../../../../src/loyalty";
import { pointsFor } from "../../../../../src/rewards-math";
import { rewardsPath } from "../../../../../src/rewards-paths";

export default async function ProductPage({ params }: PageProps<"/[lang]/catalog/products/[id]">) {
  const { lang, id } = await params;
  if (!language(lang)) notFound();
  const product = (await catalogProducts()).find(item => item.id === id);
  if (!product) notFound();
  const category = (await catalogCategories()).find(item => item.id === product.category);
  const variants = process.env.DATABASE_URL && (await pickupConfiguration()).enabled ? (await officialPrices()).filter(row => row.id === id) : [];
  const fr = lang === "fr";
  // Points hint only next to an official price; always before tax, and labelled as preview while the program is inactive.
  const program = variants.length && process.env.DATABASE_URL ? await loyaltyProgram().catch(() => undefined) : undefined;
  const hint = program?.previewVisible && program.pointsPerDollar && !program.earnCategories?.length ? { rate: program.pointsPerDollar, live: programStages(program).accrualOperational, min: program.minOrderCents } : undefined;
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/catalog?category=${product.category}`}>{category?.[lang]}</Link>
    <h1>{product[lang]}</h1>
    {product.image && hasPublicImage(product.image) && <Image src={product.image} width={600} height={570} alt=""/>}
    {variants.length ? <>
      <ul>{variants.map(row => <li key={row.size}>{modifiers[row.size][lang]} · {money(row.cents, lang)}{hint && row.cents >= hint.min && <small data-testid="points-hint"> · {fr ? `≈ ${pointsFor(row.cents, hint.rate)} points` : `≈ ${pointsFor(row.cents, hint.rate)} points`}{hint.live ? "" : (fr ? " (aperçu)" : " (preview)")}</small>}</li>)}</ul>
      {hint && <p className="fine-print">{fr ? "Points estimés sur le prix avant taxes, si la commande est liée à un compte ou à une carte et terminée. " : "Estimated points on the pre-tax price, if the order is linked to an account or card and completed. "}<Link href={rewardsPath[lang]}>{fr ? "Récompenses Salut" : "Salut Rewards"}</Link></p>}
      <Link className="button" href={`/${lang}/catalog#order-${id}`}>{fr ? "Personnaliser pour la cueillette" : "Customize for pickup"}</Link>
    </> : <p role="status">{fr ? "Indisponible pour la commande en ligne : le prix ou les heures de cueillette ne sont pas encore publiés." : "Unavailable for online ordering: the price or pickup hours have not been published yet."}</p>}
  </section>;
}
