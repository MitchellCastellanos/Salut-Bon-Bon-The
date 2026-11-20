import { demoMode } from "../../src/demo-mode";
import { orderHref } from "../../src/order-links";
import { analyticsAllowed, analyticsEnabled } from "../../src/analytics";
import { AnalyticsPreference } from "./analytics-client";
import { usesOfficialCatalog } from "../../src/catalog-mode";
import { Brand } from "../../src/brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ConsoleShell } from "./console-shell";
import { CartCount } from "../../src/cart-count";
import { LanguageLink } from "../../src/language-link";
import { language } from "../../src/domain";
import { StorefrontIcon } from "../../src/storefront-art";
import { instagramUrl, rewardsName } from "../../src/storefront-content";
import { pickupConfiguration } from "../../src/store-settings";
import { AddressBlock, HoursList } from "../../src/business-view";
import { loyaltyProgram } from "../../src/loyalty";
import { rewardsPath } from "../../src/rewards-paths";
import { StoreNavigation } from "../../src/store-navigation";

export default async function LanguageLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  // Administration and staff screens use their own frame, with none of the public header, footer or storefront queries.
  if (/^\/(?:fr|en)\/(?:admin|staff)(?:\/|$)/.test((await headers()).get("x-salut-path") ?? "")) return <ConsoleShell lang={lang}>{children}</ConsoleShell>;
  const fr = lang === "fr";
  const home = `/${lang}`;
  const official = usesOfficialCatalog();
  const instagram = instagramUrl();
  const config = official ? await pickupConfiguration().catch(() => null) : null;
  // The rewards link follows the ADMIN "public preview visible" switch. If the database is unreachable the link stays visible.
  const showRewards = official || process.env.DATABASE_URL ? await loyaltyProgram().then(p => p.previewVisible, () => true) : true;
  const schedule = config?.policy ?? null;
  const profile = config?.profile ?? null;
  return <>
    <a className="skip" href="#main">{fr ? "Aller au contenu" : "Skip to content"}</a>
    <header className="top"><div className="wrap storefront-nav">
      <Brand href={home}/>
      <StoreNavigation lang={lang} showRewards={showRewards} orderHref={orderHref(lang)} demo={demoMode()}/>
      <div className="header-actions">
        <Link className="icon-link" href={`${home}/account`} aria-label={fr ? "Compte client" : "Customer account"}><StorefrontIcon name="account"/></Link>
        <Link className="icon-link" href={orderHref(lang)} aria-label={fr ? "Panier" : "Cart"} aria-describedby="header-cart-count"><StorefrontIcon name="bag"/><CartCount official={official}/></Link>
        <LanguageLink lang={lang}/>
        <Link className="button header-order" href={orderHref(lang)}><StorefrontIcon name="bag"/>{fr ? "Commander" : "Order"}</Link>
      </div>
    </div></header>
    <main id="main">{children}</main>
    <footer className="bottom rich-footer" id="find-us">
      <div className="wrap footer-grid">
        <div><Brand href={home}/></div>
        <div><h2>Menu</h2><Link href={`${home}/catalog?category=milk-tea`}>{fr ? "Bubble thé au lait" : "Milk bubble tea"}</Link><Link href={`${home}/catalog?category=fruit-tea`}>{fr ? "Thés aux fruits" : "Fruit teas"}</Link><Link href={`${home}/catalog?category=matcha`}>Matcha</Link>{showRewards && <Link href={rewardsPath[lang]}>{rewardsName[lang]}</Link>}</div>
        <div><h2>{fr ? "Nous trouver" : "Find us"}</h2>{profile ? <AddressBlock lang={lang} profile={profile}/> : <p>Montréal, Québec<br/>{official ? fr ? "L’adresse sera publiée par l’équipe." : "The address will be published by the team." : fr ? "Adresse à confirmer" : "Address to be confirmed"}</p>}</div>
        <div><h2>{fr ? "Heures d’ouverture" : "Opening hours"}</h2>{schedule ? <HoursList lang={lang} policy={schedule} short/> : <p>{official ? (fr ? "Les heures seront publiées par l’équipe." : "Hours will be published by the team.") : (fr ? "Horaires à confirmer" : "Hours to be confirmed")}</p>}{instagram && <a href={instagram}>Instagram</a>}</div>
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
