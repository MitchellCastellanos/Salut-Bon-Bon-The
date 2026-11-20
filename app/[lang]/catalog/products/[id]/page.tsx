import { customerSession } from "../../../../../src/customer";
import { isFavorite } from "../../../../../src/favorites";
import { toggleFavoriteAction } from "../../../account/actions";
import Image from "next/image";
import { hasPublicImage } from "../../../../../src/storefront-art";

import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogProducts } from "../../../../../src/catalog";
import { language } from "../../../../../src/domain";
import { StorefrontIcon } from "../../../../../src/storefront-art";
import { drinkPhoto } from "../../../../../src/drink-photography";
import { OrderExperience } from "../../order-experience";
import { CatalogBackLink } from "../../catalog-back-link";

export default async function ProductPage({ params }: PageProps<"/[lang]/catalog/products/[id]">) {
  const { lang, id } = await params;
  if (!language(lang)) notFound();
  const product = (await catalogProducts()).find(item => item.id === id);
  if (!product) notFound();
  const photo = drinkPhoto(product);
  const fr = lang === "fr";
  const customer = process.env.DATABASE_URL ? await customerSession().catch(() => undefined) : undefined;
  const favorite = customer ? await isFavorite(customer.id, id).catch(() => false) : false;
  return <section className="wrap catalog-page">
    <CatalogBackLink lang={lang} productId={id} category={product.category}/>
    {process.env.DATABASE_URL && (customer ? <form action={toggleFavoriteAction.bind(null, lang, id)}><button className="outline" aria-pressed={favorite}>{favorite ? (fr ? "♥ Retirer des favoris" : "♥ Remove from favorites") : (fr ? "♡ Ajouter aux favoris" : "♡ Add to favorites")}</button></form> : <p className="fine-print"><Link href={`/${lang}/account`}>{fr ? "Connectez-vous pour enregistrer vos favoris." : "Sign in to save favorites."}</Link></p>)}
    <h1>{product[lang]}</h1>
    <div className={"catalog-visual catalog-detail-visual catalog-visual--" + product.category}>{photo && hasPublicImage(photo.path) ? <Image src={photo.path} width={600} height={570} alt={photo.exact ? product[lang] : (fr ? "Photo illustrative" : "Illustrative photo")}/> : <span className="catalog-fallback"><StorefrontIcon name={product.category === "matcha" ? "matcha" : product.category === "smoothies" ? "smoothie" : product.category === "lemonade" ? "lemonade" : product.category === "fruit-tea" ? "fruit" : "milk"}/></span>}</div>
    {!product.available ? <p role="status" data-testid="unavailable"><strong>{fr ? "Momentanément indisponible." : "Currently unavailable."}</strong> {fr ? "Cette boisson ne peut pas être commandée pour le moment." : "This drink cannot be ordered right now."}</p>
    : <OrderExperience lang={lang} mode="product" productId={id}/>}
  </section>;
}
