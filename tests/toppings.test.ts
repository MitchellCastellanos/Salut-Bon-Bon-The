import { describe, expect, it } from "vitest";
import { selectionCost, type CatalogOptionGroup } from "../src/catalog-options";

const opt = (id: string, cents = 100, def = false) => ({ id, fr: id, en: id, cents, default: def });
const groups: CatalogOptionGroup[] = [
  { id: "tapioca", min: 1, max: 2, options: [opt("tapioca-tapioca", 0, true), opt("tapioca-extra")] },
  { id: "popping", min: 0, max: 12, options: [opt("popping-mango"), opt("popping-cherry")] },
  { id: "jelly", min: 0, max: 12, options: [opt("jelly-rainbow"), opt("jelly-aloe"), opt("jelly-lychee")] },
  { id: "brown-sugar", min: 0, max: 12, options: [opt("brown-sugar-brown-sugar")] },
];

describe("topping rule: one included topping (tapioca or a popping pearl), every extra $1.00", () => {
  // The base tapioca is stored at $0 in the catalog: as a topping it still counts at the standard price.
  it("includes tapioca for free", () => expect(selectionCost(groups, ["tapioca-tapioca"]).cents).toBe(0));
  it("includes one popping pearl instead of tapioca for free", () => expect(selectionCost(groups, ["popping-mango"]).cents).toBe(0));
  it("charges $1.00 for each extra, whatever its kind", () => {
    expect(selectionCost(groups, ["tapioca-tapioca", "jelly-rainbow"]).cents).toBe(100);
    expect(selectionCost(groups, ["popping-cherry", "jelly-rainbow", "jelly-aloe", "brown-sugar-brown-sugar"]).cents).toBe(300);
    expect(selectionCost(groups, ["tapioca-tapioca", "popping-mango"]).cents).toBe(100);
    expect(selectionCost(groups, ["tapioca-tapioca", "tapioca-extra"]).cents).toBe(100);
    expect(selectionCost(groups, ["tapioca-tapioca", "popping-mango", "popping-cherry", "jelly-lychee"]).cents).toBe(300);
  });
  it("offers the six jellies the owner listed", () => {
    for (const id of ["jelly-rainbow", "jelly-aloe", "jelly-lychee"]) expect(selectionCost(groups, ["tapioca-tapioca", id]).cents).toBe(100);
  });
  it("requires a tapioca or popping pearl, rejects duplicates and unknown options", () => {
    expect(() => selectionCost(groups, [])).toThrow("MENU");
    expect(() => selectionCost(groups, ["jelly-rainbow"])).toThrow("MENU");
    expect(() => selectionCost(groups, ["tapioca-tapioca", "tapioca-tapioca"])).toThrow("MENU");
    expect(() => selectionCost(groups, ["tapioca-tapioca", "does-not-exist"])).toThrow("MENU");
  });
  it("is independent of the order the options are listed", () => {
    expect(selectionCost(groups, ["jelly-rainbow", "popping-mango"]).cents).toBe(100);
  });
  it("leaves drinks without tapioca or popping groups to their own limits", () => {
    expect(selectionCost([{ id: "jelly", min: 0, max: 2, options: [opt("jelly-rainbow")] }], ["jelly-rainbow"]).cents).toBe(100);
  });
});
