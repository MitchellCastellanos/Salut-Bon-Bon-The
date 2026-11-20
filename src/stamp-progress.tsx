import Image from "next/image";
import type { Lang } from "./domain";
import { hasPublicImage, StorefrontIcon } from "./storefront-art";
import { stampCard, stampsForReward } from "./rewards-math";

const art = { filled: "/rewards/stamp-filled.webp", empty: "/rewards/stamp-empty.webp", free: "/rewards/stamp-free.webp" } as const;

/** Customer-facing message for the card, derived only from the ledger balance. */
export function stampMessage(balance: number, lang: Lang, required = stampsForReward) {
  const card = stampCard(balance, required);
  const fr = lang === "fr";
  if (card.ready) return card.freeDrinks > 1
    ? (fr ? `${card.freeDrinks} boissons gratuites vous attendent ! Présentez votre code au comptoir.` : `${card.freeDrinks} free drinks are waiting for you! Show your code at the counter.`)
    : (fr ? "Votre boisson gratuite est prête ! Présentez votre code au comptoir." : "Your free drink is ready! Show your code at the counter.");
  if (card.filled === 0) return fr ? `Achetez ${required} boissons, la ${required + 1}e est gratuite.` : `Buy ${required} drinks, the ${required + 1}th is free.`;
  return card.toGo === 1
    ? (fr ? "Encore 1 boisson et la prochaine est gratuite !" : "1 more drink and your next one is free!")
    : (fr ? `Encore ${card.toGo} boissons et la prochaine est gratuite !` : `${card.toGo} more drinks and your next one is free!`);
}

/**
 * Stamp-card progress bar: one slot per purchased drink plus a final gift slot for the free drink. Pure rendering from the
 * balance (no client state), so it works in server pages. Uses the optional artwork under /public/rewards when present and
 * falls back to built-in icons otherwise. `balance` is omitted on the public page, which shows the rules, not a customer.
 */
export function StampProgress({ balance, lang, required = stampsForReward, example = false }: { balance: number; lang: Lang; required?: number; example?: boolean }) {
  const card = stampCard(balance, required);
  const fr = lang === "fr";
  const message = stampMessage(balance, lang, required);
  const slot = (kind: keyof typeof art) => hasPublicImage(art[kind])
    ? <Image src={art[kind]} alt="" width={56} height={56}/>
    : <StorefrontIcon name={kind === "free" ? "gift" : "pearls"}/>;
  return <div className={`stamp${card.ready ? " ready" : ""}`} data-testid="stamp-progress" data-filled={card.filled} data-required={card.required}>
    <p className="stamp-head"><strong>{card.filled}<small> / {card.required}</small></strong>
      <span>{fr ? (card.required === 1 ? "tampon" : "tampons") : (card.required === 1 ? "stamp" : "stamps")}</span></p>
    <div className="stamp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={card.required} aria-valuenow={card.filled}
      aria-valuetext={fr ? `${card.filled} tampons sur ${card.required}` : `${card.filled} of ${card.required} stamps`}
      aria-label={fr ? "Progression vers votre boisson gratuite" : "Progress toward your free drink"}><i style={{ width: `${Math.round(card.share * 100)}%` }}/></div>
    <ol className="stamp-slots" aria-hidden="true">
      {Array.from({ length: card.required }, (_, index) => <li key={index} className={index < card.filled ? "on" : ""}>{slot(index < card.filled ? "filled" : "empty")}<small>{index + 1}</small></li>)}
      <li className={`free${card.ready ? " on" : ""}`}>{slot("free")}<small>{fr ? "Gratuite" : "Free"}</small></li>
    </ol>
    <p className="stamp-msg" role="status" aria-live="polite">{message}{card.carried > 0 && (fr ? ` (+${card.carried} tampons reportés)` : ` (+${card.carried} stamps carried over)`)}</p>
    {example && <p className="fine-print">{fr ? "Exemple illustratif, sans lien avec une vraie carte." : "Illustrative example, not a real card."}</p>}
  </div>;
}

/** Ledger entry label for customer history lists. */
export function ledgerLabel(kind: string, lang: Lang) {
  const fr = lang === "fr";
  return kind === "earn" ? (fr ? "Tampons gagnés" : "Stamps earned") : kind === "redeem" ? (fr ? "Boisson gratuite échangée" : "Free drink redeemed")
    : kind === "reverse" ? (fr ? "Tampons repris (remboursement)" : "Stamps reversed (refund)") : (fr ? "Ajustement" : "Adjustment");
}
