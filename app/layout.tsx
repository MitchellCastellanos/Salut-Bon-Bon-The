import type { Metadata } from "next";
import { headers } from "next/headers";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Salut Bon Bon Thé", template: "%s | Salut Bon Bon Thé" },
  description: "Thés aux perles et boissons fruitées à Montréal. Bubble tea and fruit teas in Montréal.",
  referrer: "no-referrer",
  ...(process.env.SITE_URL ? { metadataBase: new URL(process.env.SITE_URL) } : {}),
};
export default async function Layout({ children }: { children: React.ReactNode }) {
  const lang = (await headers()).get("x-salut-lang") === "en" ? "en-CA" : "fr-CA";
  return <html lang={lang}><body>{children}</body></html>;
}
