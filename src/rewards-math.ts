/**
 * Pure Salut Rewards arithmetic. No I/O, so server pages, the public calculator and the tests share one definition.
 * All amounts are integer cents; points are integers.
 *
 * Rounding rule: points are computed once per order on the whole eligible pre-tax subtotal and ROUNDED DOWN
 * (floor), never per line and never up. With 10 points per $1 that is floor(cents / 10).
 */
export const maxHypotheticalCents = 500_000;

/** Points earned on `eligibleCents` (pre-tax, after discounts, excluding tips and redeemed rewards). */
export function pointsFor(eligibleCents: number, perDollar: number) {
  if (!Number.isSafeInteger(eligibleCents) || eligibleCents <= 0 || !Number.isSafeInteger(perDollar) || perDollar <= 0) return 0;
  return Math.floor(eligibleCents * perDollar / 100);
}

/** Cash value (cents) of `points` at the configured reward ratio, rounded down. */
export function valueCents(points: number, reward: { pointsCost: number; discountCents: number }) {
  if (points <= 0 || reward.pointsCost <= 0) return 0;
  return Math.floor(points * reward.discountCents / reward.pointsCost);
}

/** Effective return as a percentage of eligible spend, derived from the real rate and reward (not hard-coded). */
export function returnPercent(perDollar: number | null, reward: { pointsCost: number; discountCents: number } | null) {
  if (!perDollar || !reward || reward.pointsCost <= 0) return null;
  const percent = perDollar * reward.discountCents / reward.pointsCost;
  return Math.round(percent * 100) / 100;
}

/** Progress toward a reward: share (0–1) and points still missing. */
export function progress(points: number, cost: number) {
  if (cost <= 0) return { share: 0, missing: 0 };
  return { share: Math.min(1, Math.max(0, points / cost)), missing: Math.max(0, cost - points) };
}

/** Eligible spend (cents) still needed to cover `missing` points. */
export function spendToEarn(missingPoints: number, perDollar: number) {
  if (missingPoints <= 0 || perDollar <= 0) return 0;
  return Math.ceil(missingPoints * 100 / perDollar);
}

/**
 * Points that remain valid after refunding `refundedCents` of an order whose eligible base was `eligibleCents` and
 * which earned `earned` points: floor(earned x remaining / eligible). A full refund keeps 0.
 */
export function pointsKeptAfterRefund(earned: number, eligibleCents: number, refundedCents: number) {
  if (eligibleCents <= 0) return 0;
  const remaining = Math.max(0, eligibleCents - refundedCents);
  return Math.floor(earned * remaining / eligibleCents);
}

/** Parses a user-typed dollar amount ("12.50", "12,5") into cents, or undefined when it is not a valid amount. */
export function parseDollars(text: string) {
  const match = text.trim().replace(",", ".").match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || 0);
  return cents > 0 && cents <= maxHypotheticalCents ? cents : undefined;
}

export type RewardState = "available" | "coming_soon" | "unavailable";
/**
 * Public state of a reward. A reward is only "available" (redeemable) when the program is operational,
 * redemption is switched on and the ADMIN offered it. A reward that is not offered while the program is not operational
 * is "coming soon"; one that is not offered while the program is operational is "unavailable".
 */
export function rewardState(reward: { available: boolean }, ops: { redemptionOperational: boolean; active: boolean }): RewardState {
  if (reward.available && ops.redemptionOperational) return "available";
  if (!ops.active || !ops.redemptionOperational) return "coming_soon";
  return "unavailable";
}
