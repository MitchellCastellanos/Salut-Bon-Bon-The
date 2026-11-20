/**
 * Pure Salut Rewards arithmetic. The program is a stamp card: every eligible drink earns one stamp and the 10th drink is
 * free. A stamp is stored as one unit of the ledger balance, and the free drink is a reward that costs `stampsForReward`
 * stamps (9 purchased, the 10th is the reward). No I/O, so server pages and the tests share one definition.
 */

/**
 * Stamps that remain valid after refunding `refundedCents` of an order whose eligible base was `eligibleCents` and which
 * earned `earned` stamps: floor(earned x remaining / eligible). A full refund keeps 0. Mirrors `loyalty_reverse_refund` in SQL.
 */
export function stampsKeptAfterRefund(earned: number, eligibleCents: number, refundedCents: number) {
  if (eligibleCents <= 0) return 0;
  const remaining = Math.max(0, eligibleCents - refundedCents);
  return Math.floor(earned * remaining / eligibleCents);
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

/** Stamps needed for the free drink: 9 drinks purchased, the 10th is free. */
export const stampsForReward = 9;
/** Largest number of stamps a single order or counter visit can earn (to be confirmed by the owner). */
export const maxStampsPerOrder = 10;

/** Stamps for the order lines that count: one per drink, quantities summed, capped per order. Invalid quantities count as 0. */
export function stampsForItems(items: { quantity?: unknown }[]) {
  const drinks = items.reduce((sum, item) => sum + (Number.isSafeInteger(item.quantity) && (item.quantity as number) > 0 ? item.quantity as number : 0), 0);
  return Math.min(drinks, maxStampsPerOrder);
}

export type StampCard = {
  /** Stamps shown on the card (never more than `required`). */
  filled: number; required: number; toGo: number; share: number;
  /** True once a free drink can be redeemed. */
  ready: boolean;
  /** Free drinks already earned and not yet redeemed. */
  freeDrinks: number;
  /** Stamps beyond the first free drink, carried over to the next card. */
  carried: number;
};
/** Derives everything the progress bar shows from the ledger balance. */
export function stampCard(balance: number, required = stampsForReward): StampCard {
  const safe = Number.isSafeInteger(balance) && balance > 0 ? balance : 0;
  const need = Number.isSafeInteger(required) && required > 0 ? required : stampsForReward;
  const freeDrinks = Math.floor(safe / need);
  const filled = Math.min(safe, need);
  return { filled, required: need, toGo: Math.max(0, need - safe), share: filled / need, ready: freeDrinks > 0, freeDrinks, carried: freeDrinks > 0 ? safe - need : 0 };
}
