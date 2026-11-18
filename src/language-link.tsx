"use client";
import { usePathname } from "next/navigation";
import type { Lang } from "./domain";

export function LanguageLink({ lang }: { lang: Lang }) {
  const path = usePathname();
  const target = lang === "fr" ? "en" : "fr";
  // A full navigation refreshes the document language and localized metadata.
  return <a href={path.replace(/^\/(fr|en)(?=\/|$)/, `/${target}`)} lang={target}
    aria-label={target === "en" ? "English" : "Français"}>{target.toUpperCase()}</a>;
}
