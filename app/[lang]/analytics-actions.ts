"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { analyticsAllowed, analyticsCookie, analyticsEnabled, campaignIds } from "../../src/analytics";
import { database } from "../../src/db";

const eventSchema = z.enum([
  "page_view", "hero_impression", "hero_click", "campaign_click", "category_click",
  "product_view", "collection_visit", "add_to_cart", "checkout_start",
]);

export async function setAnalyticsChoice(value: unknown) {
  if (!analyticsEnabled() || typeof value !== "boolean") return false;
  (await cookies()).set(analyticsCookie, value ? "yes" : "no", {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180,
    secure: process.env.SITE_URL?.startsWith("https://") ?? false,
  });
  return value;
}

export async function recordAnalytics(event: unknown, campaign?: unknown) {
  if (!await analyticsAllowed()) return;
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) return;
  const id = z.enum(campaignIds).safeParse(campaign);
  await (await database()).query(`
    INSERT INTO marketing_events (event, campaign_id)
    VALUES ($1, (SELECT id FROM marketing_campaigns WHERE id = $2))
  `, [parsed.data, id.success ? id.data : null]);
}
