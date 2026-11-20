"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Lang } from "../../src/domain";

export type ConsoleLink = { href: string; label: string };
export type ConsoleSection = { title: string; links: ConsoleLink[] };

function active(pathname: string, href: string, siblings: string[]) {
  // The deepest matching link wins, so /staff does not stay highlighted on /staff/counter.
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`) && !siblings.some(other => other.length > href.length && (pathname === other || pathname.startsWith(`${other}/`)));
}

function Links({ sections, onNavigate }: { sections: ConsoleSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const hrefs = sections.flatMap(section => section.links.map(link => link.href));
  return <nav className="console-links" aria-label="Administration navigation">
    {sections.map(section => <div key={section.title} className="console-group">
      {section.title && <p className="console-group-title">{section.title}</p>}
      {section.links.map(link => <Link key={link.href} href={link.href} onClick={onNavigate}
        aria-current={active(pathname, link.href, hrefs) ? "page" : undefined}>{link.label}</Link>)}
    </div>)}
  </nav>;
}

export function ConsoleSidebar({ lang, sections, name, role, siteHref, logout }: {
  lang: Lang; sections: ConsoleSection[]; name: string; role: string; siteHref: string; logout: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const footer = <div className="console-foot">
    <Link className="console-back" href={siteHref}>← Back to the website</Link>
    <p className="console-who"><strong>{name}</strong><span>{role}</span></p>
    <div className="console-foot-row">
      <form action={logout}><button type="submit" className="console-logout">Sign out</button></form></div>
  </div>;
  return <>
    <header className="console-bar">
      <Link href={`/${lang}/admin`} onClick={() => setOpen(false)}><strong>Salut Bon Bon Thé</strong> <span>Admin</span></Link>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{open ? <path d="M6 6l12 12M18 6L6 18"/> : <path d="M4 7h16M4 12h16M4 17h16"/>}</svg>
      </button>
    </header>
    {open && <div className="console-drawer"><Links sections={sections} onNavigate={() => setOpen(false)}/>{footer}</div>}
    <aside className="console-side">
      <Link className="console-brand" href={`/${lang}/admin`}><strong>Salut Bon Bon Thé</strong><span>Administration</span></Link>
      <Links sections={sections}/>
      {footer}
    </aside>
  </>;
}
