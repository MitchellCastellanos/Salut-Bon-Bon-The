"use client";
import { usePathname } from "next/navigation";
import type { Lang } from "./domain";

export function LanguageLink({ lang }: { lang: Lang }) {
  const path = usePathname();
  const target = lang === "fr" ? "en" : "fr";
  // A full navigation refreshes the document language and localized metadata.
  // Localized rewards slugs differ between languages (recompenses/carte <-> rewards/card).
  const swapped = path.replace(/^\/(fr|en)(?=\/|$)/, `/${target}`)
    .replace(/^\/(?:fr|en)\/(?:recompenses|rewards)\/(?:carte|card)(?=\/|$)/, target === "fr" ? `/fr/recompenses/carte` : `/en/rewards/card`)
    .replace(/^\/(?:fr|en)\/(?:recompenses|rewards)(?=\/|$)/, target === "fr" ? `/fr/recompenses` : `/en/rewards`);
  return <a href={swapped} lang={target}
    aria-label={target === "en" ? "English" : "Français"}>{target.toUpperCase()}</a>;
}
