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

export function selectionCost(groups: CatalogOptionGroup[], ids: string[]) {
  const choices = new Set(ids);
  if (choices.size !== ids.length) throw new Error("MENU");
  const selected: CatalogOption[] = [];
  for (const group of groups) {
    const matching = group.options.filter(option => choices.delete(option.id));
    if (matching.length < group.min || matching.length > group.max) throw new Error("MENU");
    selected.push(...matching);
  }
  if (choices.size) throw new Error("MENU");
  return { selected, cents: selected.reduce((sum, option) => sum + option.cents, 0) };
}
