import { z } from "zod";

export type Lang = "fr" | "en";
export function language(value: string): value is Lang {
  return value === "fr" || value === "en";
}
export function money(cents: number, lang: Lang) {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
}
export function pickupDate(value: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short"
  }).format(new Date(value));
}
export const categories = {
  fruit: { fr: "Thés fruités", en: "Fruit teas" },
  milk: { fr: "Thés au lait", en: "Milk teas" },
} as const;
export const products = [
  { id: "mango", category: "fruit", name: { fr: "Mangue soleil", en: "Mango sunshine" }, description: { fr: "Thé vert, mangue et une touche de passion.", en: "Green tea, mango and a splash of passion fruit." }, price: 675, color: "mango", topping: ["none", "popping"] },
  { id: "strawberry", category: "fruit", name: { fr: "Fraise pétillante", en: "Strawberry pop" }, description: { fr: "Thé au jasmin et fraises acidulées.", en: "Jasmine tea and tangy strawberries." }, price: 650, color: "strawberry", topping: ["none", "popping"] },
  { id: "taro", category: "milk", name: { fr: "Nuage de taro", en: "Taro cloud" }, description: { fr: "Thé au lait crémeux au taro.", en: "Creamy taro milk tea." }, price: 700, color: "taro", topping: ["none", "pearls"] },
  { id: "classic", category: "milk", name: { fr: "Lait & cassonade", en: "Brown sugar milk tea" }, description: { fr: "Thé noir et notes de cassonade.", en: "Black tea with notes of brown sugar." }, price: 725, color: "classic", topping: ["none", "pearls"] },
] as const;
export const modifiers = {
  regular: { fr: "Régulier", en: "Regular" }, large: { fr: "Grand", en: "Large" },
  none: { fr: "Aucune", en: "None" }, popping: { fr: "Perles éclatantes", en: "Popping pearls" },
  pearls: { fr: "Tapioca", en: "Tapioca" },
};
export const lineSchema = z.object({
  product: z.string(), size: z.enum(["regular", "large"]), sugar: z.enum(["0", "50", "100"]),
  ice: z.enum(["0", "50", "100"]), topping: z.enum(["none", "popping", "pearls"]),
  quantity: z.number().int().min(1).max(10),
});
export type Line = z.infer<typeof lineSchema>;
export const checkoutSchema = z.object({
  request: z.uuid(), lang: z.enum(["fr", "en"]), name: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(240), pickup: z.iso.datetime(), method: z.enum(["pickup", "demo"]),
  lines: z.array(lineSchema).min(1).max(20),
});
export function quote(lines: Line[]) {
  return lines.map(line => {
    const product = products.find(p => p.id === line.product);
    if (!product || !product.topping.some(topping => topping === line.topping)) throw new Error("MENU");
    return { ...line, name: product.name, subtotal: (product.price + (line.size === "large" ? 100 : 0) + (line.topping === "none" ? 0 : 75)) * line.quantity };
  });
}
export const states = ["RECEIVED", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"] as const;
export type State = typeof states[number];
export const transitions: Record<State, State[]> = {
  RECEIVED: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"], READY: ["COMPLETED", "CANCELLED"], COMPLETED: [], CANCELLED: [],
};
export const stateLabels: Record<State, Record<Lang, string>> = {
  RECEIVED: { fr: "Reçue", en: "Received" }, CONFIRMED: { fr: "Confirmée", en: "Confirmed" },
  PREPARING: { fr: "En préparation", en: "Preparing" }, READY: { fr: "Prête", en: "Ready" },
  COMPLETED: { fr: "Terminée", en: "Completed" }, CANCELLED: { fr: "Annulée", en: "Cancelled" },
};
export function pickupSlots(now = Date.now()) {
  const quarter = 15 * 60 * 1000;
  const first = Math.ceil((now + quarter) / quarter) * quarter;
  return Array.from({ length: 9 }, (_, index) => new Date(first + index * quarter).toISOString());
}
