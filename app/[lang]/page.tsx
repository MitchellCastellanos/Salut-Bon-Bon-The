import Link from "next/link";
import { notFound } from "next/navigation";
import { language, money, products } from "../../src/domain";
import { HeroGallery } from "../../src/hero-gallery";
import { Drink } from "../../src/drink";

export async function generateMetadata({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  return process.env.SITE_URL ? { alternates: { canonical: `/${lang}`, languages: { "fr-CA": "/fr", "en-CA": "/en", "x-default": "/fr" } } } : {};
}
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  return <>
    <section className="wrap hero">
      <div>
        <p className="eyebrow">{fr ? "THÉ AUX PERLES · MONTRÉAL" : "BUBBLE TEA · MONTRÉAL"}</p>
        <h1>{fr ? <>Des bulles.<br/><em>Du bonheur.</em></> : <>A little sip.<br/><em>A lot of joy.</em></>}</h1>
        <p className="intro">{fr ? "Thés fruités, laits crémeux et perles à croquer. Compose ta boisson, puis passe la chercher." : "Bright fruit teas, creamy milk teas and chewy pearls. Make it yours and pick it up."}</p>
        <Link className="button" href={`/${lang}/menu`}>{fr ? "Découvrir le menu" : "Explore the menu"} <span aria-hidden="true">↗</span></Link>
      </div>
      <HeroGallery lang={lang} slides={products.slice(0, 3).map((product, index) => ({ title: product.name[lang], scene: <Drink flavor={product.color} hero cover={index === 0}/> }))}/>
    </section>
    <section className="wrap section">
      <div className="section-head"><div><p className="eyebrow">{fr ? "MENU DE DÉMONSTRATION" : "DEMO MENU"}</p><h2>{fr ? "À siroter" : "Find your sip"}</h2></div><Link className="text-link" href={`/${lang}/menu`}>{fr ? "Voir le menu" : "View menu"} ↗</Link></div>
      <div className="product-grid">{products.map(p => <Link className="product-card" href={`/${lang}/menu#${p.id}`} key={p.id}><Drink flavor={p.color}/><div><strong>{p.name[lang]}</strong><span>{money(p.price, lang)}</span></div><p>{p.description[lang]}</p></Link>)}</div>
    </section>
    <section className="pickup" id="pickup"><div className="wrap"><h2>{fr ? "Prêt quand tu l’es." : "Pick up your way."}</h2><p>{fr ? "Choisis ta boisson et ton heure de cueillette. Suis ta commande avec ton lien privé." : "Choose your drink and pickup time. Follow your order with your private link."}</p><Link className="button" href={`/${lang}/menu`}>{fr ? "Commander" : "Start an order"} ↗</Link></div></section>
  </>;
}
