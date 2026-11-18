import Link from "next/link";
import { notFound } from "next/navigation";
import { LanguageLink } from "../../src/language-link";
import { language } from "../../src/domain";

export default async function LanguageLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!language(lang)) notFound();
  const fr = lang === "fr";
  return <>
    <a className="skip" href="#main">{fr ? "Aller au contenu" : "Skip to content"}</a>
    <header className="top"><div className="wrap bar">
      <Link href={`/${lang}`} className="wordmark">Salut Bon Bon Thé<span>.</span></Link>
      <nav aria-label={fr ? "Navigation principale" : "Main navigation"}>
        <Link href={`/${lang}/menu`}>Menu</Link>
        <Link href={`/${lang}#pickup`}>{fr ? "Cueillette" : "Pickup"}</Link>
        <LanguageLink lang={lang}/>
      </nav>
    </div></header>
    <main id="main">{children}</main>
    <footer className="bottom"><div className="wrap bar"><div><strong>Salut Bon Bon Thé</strong><div>Montréal, Québec</div></div>
      <div className="footer-links">
        <Link href={`/${lang}/legal/privacy`}>{fr ? "Confidentialité" : "Privacy"}</Link>
        <Link href={`/${lang}/legal/terms`}>{fr ? "Conditions" : "Terms"}</Link>
        <Link href={`/${lang}/staff`}>{fr ? "Espace équipe" : "Staff area"}</Link>
      </div>
    </div></footer>
  </>;
}
