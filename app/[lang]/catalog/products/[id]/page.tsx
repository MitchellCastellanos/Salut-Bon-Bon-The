import { orderHref } from "../../../../../src/order-links";
import { customerSession } from "../../../../../src/customer";
import { isFavorite } from "../../../../../src/favorites";
import { toggleFavoriteAction } from "../../../account/actions";
import Image from "next/image";
import { hasPublicImage } from "../../../../../src/storefront-art";

import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogCategories, catalogProducts } from "../../../../../src/catalog";
import { displayedCatalogPrices } from "../../../../../src/catalog-display-prices";
import { language, modifiers, money } from "../../../../../src/domain";
import { loyaltyProgram, programStages } from "../../../../../src/loyalty";
import { rewardsPath } from "../../../../../src/rewards-paths";
import { StorefrontIcon } from "../../../../../src/storefront-art";
import { drinkPhoto } from "../../../../../src/drink-photography";

export default async function ProductPage({ params }: PageProps<"/[lang]/catalog/products/[id]">) {
  const { lang, id } = await params;
  if (!language(lang)) notFound();
  const product = (await catalogProducts()).find(item => item.id === id);
  if (!product) notFound();
  const photo = drinkPhoto(product);
  const category = (await catalogCategories()).find(item => item.id === product.category);
  const variants = (await displayedCatalogPrices()).filter(row => row.id === id);
  const fr = lang === "fr";
  const customer = process.env.DATABASE_URL ? await customerSession().catch(() => undefined) : undefined;
  const favorite = customer ? await isFavorite(customer.id, id).catch(() => false) : false;
  // Stamps are a preview until the program is operational.
  const program = variants.length && process.env.DATABASE_URL ? await loyaltyProgram().catch(() => undefined) : undefined;
  const hint = program?.previewVisible && !program.earnCategories?.length ? { live: programStages(program).accrualOperational, min: program.minOrderCents } : undefined;
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/catalog?category=${product.category}`}>{category?.[lang]}</Link>
    {process.env.DATABASE_URL && (customer ? <form action={toggleFavoriteAction.bind(null, lang, id)}><button className="outline" aria-pressed={favorite}>{favorite ? (fr ? "♥ Retirer des favoris" : "♥ Remove from favorites") : (fr ? "♡ Ajouter aux favoris" : "♡ Add to favorites")}</button></form> : <p className="fine-print"><Link href={`/${lang}/account`}>{fr ? "Connectez-vous pour enregistrer vos favoris." : "Sign in to save favorites."}</Link></p>)}
    <h1>{product[lang]}</h1>
    <div className={"catalog-visual catalog-detail-visual catalog-visual--" + product.category}>{photo && hasPublicImage(photo.path) ? <Image src={photo.path} width={600} height={570} alt={photo.exact ? product[lang] : (fr ? "Photo illustrative" : "Illustrative photo")}/> : <span className="catalog-fallback"><StorefrontIcon name={product.category === "matcha" ? "matcha" : product.category === "smoothies" ? "smoothie" : product.category === "lemonade" ? "lemonade" : product.category === "fruit-tea" ? "fruit" : "milk"}/></span>}</div>
    {variants.length ? <>
      <ul>{variants.map(row => <li key={row.size}>{modifiers[row.size][lang]} · {money(row.cents, lang)}{hint && row.cents >= hint.min && <small data-testid="points-hint"> · {fr ? "1 tampon" : "1 stamp"}</small>}</li>)}</ul>
      {hint && <p className="fine-print">{fr ? "Chaque boisson rapporte un tampon (9 tampons = la 10e boisson gratuite), si la commande est liée à un compte ou à une carte et terminée. " : "Every drink earns one stamp (9 stamps = the 10th drink free), if the order is linked to an account or card and completed. "}<Link href={rewardsPath[lang]}>{fr ? "Récompenses Salut" : "Salut Rewards"}</Link></p>}
      <Link className="button" href={orderHref(lang, id)}>{fr ? "Personnaliser pour la cueillette" : "Customize for pickup"}</Link>
    </> : <Link className="button" href={orderHref(lang, id)}>{fr ? "Ajouter au panier" : "Add to cart"}</Link>}
  </section>;
}
