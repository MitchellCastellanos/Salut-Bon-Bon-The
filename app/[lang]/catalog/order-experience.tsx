import { officialLogo } from "../../../src/brand-server";
import { cardPaymentsEnabled } from "../../../src/providers/stripe";
import { pickupConfiguration } from "../../../src/store-settings";
import { officialPrices } from "../../../src/catalog-pricing";
import { catalogProducts } from "../../../src/catalog";
import { customerSession } from "../../../src/customer";
import { currentGuestCard } from "../../../src/guest-card";
import { loyaltyProgram, programStages } from "../../../src/loyalty";
import { cardPath, rewardsPath } from "../../../src/rewards-paths";
import { Menu } from "../menu/menu";
import type { Lang } from "../../../src/domain";
export async function OrderExperience({ lang, mode, productId }: { lang: Lang; mode: "product" | "cart"; productId?: string }) {
  const config = process.env.DATABASE_URL ? await pickupConfiguration() : null;
  const prices = process.env.DATABASE_URL ? await officialPrices() : [];
  const all = await catalogProducts();
  if (!config?.enabled) return <p role="status">{lang === "fr" ? "La commande en ligne est temporairement indisponible." : "Online ordering is temporarily unavailable."}</p>;
  const orderable = [...new Set(prices.map(row => row.id))].map(id => {
    const variants = prices.filter(row => row.id === id);
    return { id, category: all.find(p => p.id === id)?.category ?? "", name: { fr: variants[0].fr, en: variants[0].en }, topping: ["none" as const], groups: variants[0].groups, prices: Object.fromEntries(variants.map(row => [row.size, row.cents])) };
  });
  if (mode === "product" && !orderable.some(p => p.id === productId)) return <p>{lang === "fr" ? "Commande en ligne indisponible pour cette boisson." : "Online ordering is unavailable for this drink."}</p>;
  const program = process.env.DATABASE_URL ? await loyaltyProgram().catch(() => undefined) : undefined;
  const linked = program ? Boolean(await customerSession().catch(() => undefined) || await currentGuestCard().catch(() => undefined)) : false;
  const rewards = program?.previewVisible ? { operational: programStages(program).accrualOperational, allEligible: !program.earnCategories?.length, minOrderCents: program.minOrderCents, linked, rewardsHref: rewardsPath[lang], cardHref: cardPath[lang], accountHref: `/${lang}/account` } : undefined;
  return <Menu lang={lang} demo={false} mode={mode} rewards={rewards} photos={{}} initialCategory="all" initialProduct={productId} officialProducts={orderable} taxRates={config?.taxRates ?? []} pickupInfo={config?.profile ?? undefined} cardPayments={cardPaymentsEnabled()} logo={officialLogo()}/>;
}
