import Image from "next/image";
import { catalogCategories, catalogCollections, catalogProducts, visibleCampaigns } from "../../src/catalog";
import { usesOfficialCatalog } from "../../src/catalog-mode";
import { loyaltyProgram } from "../../src/loyalty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { language, money, products } from "../../src/domain";
import { HeroGallery } from "../../src/hero-gallery";
import { Drink } from "../../src/drink";
import { hasPublicImage, StorefrontArt, StorefrontIcon } from "../../src/storefront-art";
import { instagramUrl, menuTiles, rewardsName } from "../../src/storefront-content";

export async function generateMetadata({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  return process.env.SITE_URL ? { alternates: { canonical: `/${lang}`, languages: { "fr-CA": "/fr", "en-CA": "/en", "x-default": "/fr" } } } : {};
}

const campaigns = [
  { flavor: "mango", path: "/drinks/hero.webp", fr: ["Série mangue", "Fraîche", "Des boissons rafraîchissantes aux saveurs de mangue et de fruits tropicaux."], en: ["Mango series", "Fresh & Fruity", "Refreshing mango drinks with a taste of tropical fruit."] },
  { flavor: "strawberry", path: "/promotions/strawberry.webp", fr: ["Série fraise", "Pétillante", "Un thé fruité aux saveurs de fraise et de jasmin."], en: ["Strawberry series", "Bright & Juicy", "A fruit tea with strawberry and jasmine notes."] },
  { flavor: "taro", path: "/promotions/taro.webp", fr: ["Série taro", "Crémeuse", "Une boisson au lait et aux notes douces de taro."], en: ["Taro series", "Soft & Creamy", "A creamy milk tea with mellow taro notes."] },
] as const;

const featured = ["classic", "matcha", "taro", "mango", "strawberry"].flatMap(id => products.filter(product => product.id === id));

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const menu = `/${lang}/menu`;
  const official = usesOfficialCatalog();
  const rewardsActive = official ? await loyaltyProgram().then(p => p.active, () => undefined) : undefined;
  const promotions = await visibleCampaigns();
  const mangoHero = promotions.find(campaign => campaign.id === "fresh-mango-series");
  const officialTiles = [
    { icon: "milk", category: "milk-tea" }, { icon: "fruit", category: "fruit-tea" },
    { icon: "matcha", category: "matcha" }, { icon: "smoothie", category: "smoothies" },
    { icon: "lemonade", category: "lemonade" }, { icon: "pearls", collection: "fresh-mango-series" },
    { icon: "jelly", collection: "creme-brulee" },
  ] as const;
  const [categories, collections, highlights] = official ? await Promise.all([catalogCategories(), catalogCollections(), catalogProducts(true)]) : [[], [], []];
  const instagram = instagramUrl();
  return <>
    {official ? mangoHero && <div className="campaign-slide mango" data-analytics-hero={mangoHero.id}>
      <div className="campaign-media" aria-hidden="true"><StorefrontArt path={mangoHero.image ?? ""} sizes="100vw" priority><div className="campaign-cups"><Drink flavor="mango" illustrated/></div></StorefrontArt></div>
      <div className="wrap campaign-inner"><div className="campaign-copy">
        <h1>{mangoHero[lang]}</h1>
        <p>{fr ? mangoHero.headline_fr : mangoHero.headline_en}</p>
        <Link className="button" href={`/${lang}/catalog/fresh-mango-series`} data-analytics-event="hero_click" data-analytics-campaign={mangoHero.id}>{fr ? "Découvrir la série" : "Explore the series"}</Link>
      </div></div>
    </div> : <HeroGallery lang={lang} slides={campaigns.map(({ flavor, path, ...copy }, index) => {
      const [title, accent, description] = copy[lang];
      return { title, scene: <div className={`campaign-slide ${flavor}`}>
        <div className="campaign-media" aria-hidden="true">
          <StorefrontArt path={path} sizes="100vw" priority={index === 0}>
            <div className="campaign-cups"><Drink flavor={flavor} illustrated/><Drink flavor={flavor} illustrated/><Drink flavor={flavor} illustrated/></div>
          </StorefrontArt>
        </div>
        <div className="wrap campaign-inner"><div className="campaign-copy">
          <p className="campaign-label">{fr ? "Menu démo" : "Demo menu"}</p>
          <h1>{title}<em>{accent}</em></h1>
          <p>{description}</p>
          <Link className="button" href={menu}>{fr ? "Commander maintenant" : "Order now"} <span aria-hidden="true">→</span></Link>
        </div></div>
      </div> };
    })}/>}

    <div className="wrap home-content">
      <section className="home-section" aria-labelledby="explore">
        <div className="section-head"><h2 id="explore">{fr ? "Explorez notre menu" : "Explore Our Menu"}</h2><Link className="menu-link" href={menu}>{fr ? "Voir le menu complet" : "Explore the menu"} <span aria-hidden="true">→</span></Link></div>
        <ul className="category-grid">{official ? officialTiles.map(tile => {
          const href = "category" in tile ? `/${lang}/catalog?category=${tile.category}` : `/${lang}/catalog/${tile.collection}`;
          const item = "category" in tile ? categories.find(item => item.id === tile.category) : collections.find(item => item.id === tile.collection);
          return <li key={tile.icon} className={tile.icon}><Link className="category-tile" href={href} data-analytics-event="category_click"><StorefrontIcon name={tile.icon}/><strong>{item?.[lang]}</strong></Link></li>;
        }) : menuTiles.map(tile => {
          const content = <><StorefrontIcon name={tile.icon}/><strong>{tile[lang]}</strong></>;
          return <li key={tile.icon} className={tile.icon}>{"filter" in tile ?
            <Link className="category-tile" href={`${menu}?category=${tile.filter}`}>{content}</Link> :
            <div className="category-tile">{content}<small>{fr ? "Aperçu" : "Preview"}</small></div>}</li>;
        })}</ul>
      </section>

      {official ? <section className="home-section" aria-labelledby="favorites">
        <div className="section-head"><h2 id="favorites">{fr ? "Nos coups de cœur" : "Our Favorites"}</h2></div>
        <ul className="catalog-grid">{highlights.map(product => <li key={product.id}><Link href={`/${lang}/catalog/products/${product.id}`}>
          {product.image && hasPublicImage(product.image) && <Image className="catalog-banner" src={product.image} width={1200} height={1140} alt=""/>}
          {product[lang]}</Link></li>)}</ul>
      </section> : <section className="home-section" aria-labelledby="favorites">
        <div className="section-head"><h2 id="favorites">{fr ? "Nos coups de cœur" : "Our Favorites"}</h2><span className="demo-label">{fr ? "Menu de démonstration" : "Demo menu"}</span></div>
        <div className="favorites-grid">{featured.map(product => <Link className="favorite-card" key={product.id} href={`${menu}#${product.id}`}>
          <Drink flavor={product.color}/><strong>{product.name[lang]}</strong><span>{money(product.price, lang)}</span>
        </Link>)}</div>
      </section>}

      {promotions.length > 0 && <section className="home-section" id="promotions">
        <h2>{fr ? "Collections à découvrir" : "Explore the collections"}</h2>
        <ul className="catalog-grid">{promotions.map(collection => <li key={collection.id}>
          <Link href={`/${lang}/catalog/${collection.id}`} data-analytics-event="campaign_click" data-analytics-campaign={collection.id}><strong>{collection[lang]}</strong></Link>
          <p>{fr ? collection.headline_fr : collection.headline_en}</p>
        </li>)}</ul>
      </section>}
      <div className="home-banners">
        <section className="promo-banner pickup-banner" id="pickup">
          <div className="promo-art" aria-hidden="true"><StorefrontArt path="/promotions/pickup.webp" sizes="(max-width: 650px) 32vw, 190px"><span className="phone-art"><StorefrontIcon name="bag"/></span></StorefrontArt></div>
          <div><h2>{official ? fr ? "Cueillette en magasin" : "In-store pickup" : fr ? "Commandez en ligne et récupérez en magasin" : "Order Online and Pick Up In Store"}</h2>
            {!official && <p>{fr ? "Choisissez votre boisson et votre heure de cueillette." : "Choose your drink and pickup time."}</p>}
            <Link className="button" href={menu}>{official ? fr ? "Voir le catalogue" : "Browse the catalog" : fr ? "Commander pour emporter" : "Order for pickup"} <span aria-hidden="true">→</span></Link></div>
        </section>
        <section className="promo-banner rewards-banner" id="rewards">
          <div><h2><StorefrontIcon name="gift"/>{rewardsName[lang]}</h2>
            <p>{fr ? "Cumulez des points à chaque achat admissible et échangez-les contre des récompenses." : "Earn points on eligible purchases and redeem them for rewards."}</p>
            <Link className="button purple" href={`/${lang}/account/rewards`}>{fr ? "Voir ma carte Récompenses" : "View my rewards card"} <span aria-hidden="true">→</span></Link>
            <p className="account-status">{rewardsActive === undefined ? (fr ? "Créez un compte pour suivre vos commandes et adhérer au programme." : "Create an account to follow your orders and join the program.") : rewardsActive ? (fr ? "Programme actif : cumulez des points à chaque achat admissible." : "Program active: earn points on every eligible purchase.") : (fr ? "Le programme n’est pas actif pour le moment : aucun point n’est cumulé." : "The program is not active right now: no points are being earned.")}</p>
          </div>
          <div className="promo-art" aria-hidden="true"><StorefrontArt path="/promotions/rewards.webp" sizes="(max-width: 650px) 32vw, 190px"><span className="rewards-art"><StorefrontIcon name="gift"/><span>★ ★ ★</span></span></StorefrontArt></div>
        </section>
      </div>
      <section className="home-section social" aria-labelledby="social">
        <div className="section-head"><h2 id="social"><StorefrontIcon name="instagram"/>{instagram ? fr ? "Suivez-nous sur Instagram" : "Follow us on Instagram" : fr ? "Galerie Instagram" : "Instagram gallery"}</h2>
          {instagram ? <a href={instagram}>Instagram ↗</a> : <span className="demo-label">{fr ? "Aperçu de démonstration" : "Demo preview"}</span>}</div>
        <ul className="social-gallery" tabIndex={0} aria-label={fr ? "Galerie de boissons défilante" : "Scrollable drink gallery"}>
          {["matcha", "mango", "strawberry", "classic", "taro"].map(flavor => <li key={flavor}>
            <StorefrontArt path={`/gallery/${flavor}.webp`} sizes="(max-width: 650px) 43vw, 220px"><Drink flavor={flavor}/></StorefrontArt>
          </li>)}
        </ul>
      </section>
    </div>
  </>;
}
