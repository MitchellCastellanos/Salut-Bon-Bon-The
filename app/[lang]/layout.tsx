import { analyticsAllowed, analyticsEnabled } from "../../src/analytics";
import { AnalyticsPreference } from "./analytics-client";
import { usesOfficialCatalog } from "../../src/catalog-mode";
import { Brand } from "../../src/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CartCount } from "../../src/cart-count";
import { LanguageLink } from "../../src/language-link";
import { language } from "../../src/domain";
import { StorefrontIcon } from "../../src/storefront-art";
import { instagramUrl, rewardsName } from "../../src/storefront-content";
import { days } from "../../src/pickup-policy";
import { pickupConfiguration } from "../../src/store-settings";

export default async function LanguageLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  const home = `/${lang}`;
  const official = usesOfficialCatalog();
  const instagram = instagramUrl();
  const schedule = official ? await pickupConfiguration().then(c => c.policy, () => null) : null;
  const dayLabel: Record<string, [string, string]> = { Mon: ["Lun", "Mon"], Tue: ["Mar", "Tue"], Wed: ["Mer", "Wed"], Thu: ["Jeu", "Thu"], Fri: ["Ven", "Fri"], Sat: ["Sam", "Sat"], Sun: ["Dim", "Sun"] };
  return <>
    <a className="skip" href="#main">{fr ? "Aller au contenu" : "Skip to content"}</a>
    <header className="top"><div className="wrap storefront-nav">
      <Brand href={home}/>
      <nav aria-label={fr ? "Navigation principale" : "Main navigation"}>
        <Link href={home}>{fr ? "Accueil" : "Home"}</Link>
        <Link href={`${home}/menu`}>Menu</Link>
        <Link href={`${home}/catalog`}>{fr ? "Catalogue" : "Catalog"}</Link>
        <Link href={`${home}#promotions`}>Promotions</Link>
        <Link href={`${home}/account/rewards`}>{fr ? "Récompenses" : "Rewards"}</Link>
        <Link href="#find-us">{fr ? "Nous trouver" : "Find us"}</Link>
      </nav>
      <div className="header-actions">
        <Link className="icon-link" href={`${home}/account`} aria-label={fr ? "Compte client" : "Customer account"}><StorefrontIcon name="account"/></Link>
        <Link className="icon-link" href={`${home}/${official ? "catalog" : "menu"}#cart`} aria-label={fr ? "Panier" : "Cart"} aria-describedby="header-cart-count"><StorefrontIcon name="bag"/><CartCount official={official}/></Link>
        <LanguageLink lang={lang}/>
        <Link className="button header-order" href={`${home}/menu`}><StorefrontIcon name="bag"/>{fr ? "Commander pour emporter" : "Order for pickup"}</Link>
      </div>
    </div></header>
    <main id="main">{children}</main>
    <footer className="bottom rich-footer" id="find-us">
      <div className="wrap footer-grid">
        <div><Brand href={home}/></div>
        <div><h2>Menu</h2><Link href={`${home}/menu?category=milk`}>{fr ? "Bubble thé au lait" : "Milk bubble tea"}</Link><Link href={`${home}/menu?category=fruit`}>{fr ? "Thés aux fruits" : "Fruit teas"}</Link><Link href={`${home}/menu?category=matcha`}>Matcha</Link><Link href={`${home}#rewards`}>{rewardsName[lang]}</Link></div>
        <div><h2>{fr ? "Nous trouver" : "Find us"}</h2><p>Montréal, Québec<br/>{fr ? "Adresse communiquée par l’équipe" : "Address provided by the team"}</p></div>
        <div><h2>{fr ? "Heures d’ouverture" : "Opening hours"}</h2>{schedule ? <ul className="footer-hours">{days.map(day => <li key={day}><span>{dayLabel[day][fr ? 0 : 1]}</span> {schedule.hours[day]?.length ? schedule.hours[day]!.map(([a, b]) => `${a}–${b}`).join(", ") : (fr ? "Fermé" : "Closed")}</li>)}</ul> : <p>{official ? (fr ? "Les heures seront publiées par l’équipe." : "Hours will be published by the team.") : (fr ? "Horaires à confirmer" : "Hours to be confirmed")}</p>}{instagram && <a href={instagram}>Instagram</a>}</div>
      </div>
      <div className="wrap footer-legal"><span>© {new Date().getFullYear()} Salut Bon Bon Thé</span>
        <Link href={`${home}/legal/privacy`}>{fr ? "Confidentialité" : "Privacy"}</Link>
        <Link href={`${home}/legal/terms`}>{fr ? "Conditions" : "Terms"}</Link>
        {analyticsEnabled() && <AnalyticsPreference lang={lang} initial={await analyticsAllowed()}/>}
        <Link href={`${home}/staff`}>{fr ? "Espace équipe" : "Staff area"}</Link>
      </div>
    </footer>
  </>;
}
