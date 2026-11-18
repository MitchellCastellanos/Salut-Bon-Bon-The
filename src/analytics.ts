import { cookies } from "next/headers";

export const analyticsCookie = "salut-analytics";
export const campaignIds = ["fresh-mango-series", "creme-brulee", "house-lemonade", "explore-menu"] as const;

export function analyticsEnabled() {
  return Boolean(process.env.DATABASE_URL && process.env.SALUT_ANALYTICS_ENABLED === "1");
}

export async function analyticsAllowed() {
  return analyticsEnabled() && (await cookies()).get(analyticsCookie)?.value === "yes";
}
