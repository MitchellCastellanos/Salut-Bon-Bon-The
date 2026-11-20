export type CatalogOption = {
  id: string;
  fr: string;
  en: string;
  cents: number;
  default: boolean;
};

export type CatalogOptionGroup = {
  id: string;
  min: number;
  max: number;
  options: CatalogOption[];
};

/** Option groups that make up the included topping: tapioca and the popping pearls. */
export const includedToppingGroups = ["tapioca", "popping"] as const;
/** The tapioca serving that counts as a normal topping; "extra tapioca" is a separate option. */
export const baseTapiocaId = "tapioca-tapioca";
export const isIncludedChoice = (groupId: string, optionId: string) => groupId === "popping" || (groupId === "tapioca" && optionId === baseTapiocaId);

/**
 * Prices a drink's topping selection. Every drink includes ONE topping chosen from tapioca or the popping pearls (the most expensive
 * one selected from that pool is free); every other topping, including a second tapioca or a second popping flavor, costs its own
 * surcharge ($1.00 each at the time of writing, edited by an ADMIN). A drink must therefore carry at least one tapioca or popping pearl.
 */
export function selectionCost(groups: CatalogOptionGroup[], ids: string[]) {
  const choices = new Set(ids);
  if (choices.size !== ids.length) throw new Error("MENU");
  const selected: CatalogOption[] = [];
  const pool: CatalogOption[] = [];
  // The base tapioca is stored at $0 (older rule: "tapioca included"). As a topping it is priced like the others, so that a
  // tapioca chosen as an extra is charged; the free topping is applied below. Standard topping price = the lowest positive surcharge.
  const prices = groups.flatMap(group => group.options.map(option => option.cents)).filter(cents => cents > 0);
  const standard = prices.length ? Math.min(...prices) : 100;
  const price = (option: CatalogOption) => option.id === baseTapiocaId && option.cents === 0 ? standard : option.cents;
  for (const group of groups) {
    const matching = group.options.filter(option => choices.delete(option.id));
    const inPool = (includedToppingGroups as readonly string[]).includes(group.id);
    // The minimum of the two pool groups applies to the pool as a whole (below), not to each group.
    if (matching.length > group.max || (!inPool && matching.length < group.min)) throw new Error("MENU");
    selected.push(...matching);
    pool.push(...matching.filter(option => isIncludedChoice(group.id, option.id)));
  }
  if (choices.size) throw new Error("MENU");
  if (groups.some(group => (includedToppingGroups as readonly string[]).includes(group.id))) {
    if (!pool.length) throw new Error("MENU");
    const free = Math.max(...pool.map(price));
    return { selected, cents: selected.reduce((sum, option) => sum + price(option), 0) - free };
  }
  return { selected, cents: selected.reduce((sum, option) => sum + price(option), 0) };
}
