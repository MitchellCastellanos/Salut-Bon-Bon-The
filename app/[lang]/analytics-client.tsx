"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Lang } from "../../src/domain";
import { recordAnalytics, setAnalyticsChoice } from "./analytics-actions";

const eventName = "salut-analytics-event";
const campaignKey = "salut-campaign";

export function AnalyticsPreference({ lang, initial }: { lang: Lang; initial: boolean }) {
  const [allowed, setAllowed] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const pathname = usePathname();
  const fr = lang === "fr";
  const publicPage = /^\/(fr|en)(\/(menu|catalog(?:\/[a-z0-9-]+|\/products\/[a-zA-Z0-9-]+)?))?$/.test(pathname);

  useEffect(() => {
    if (!allowed || !publicPage) return;
    const send = (event: string, campaign?: string) => { void recordAnalytics(event, campaign).catch(() => {}); };
    const currentCampaign = document.querySelector<HTMLElement>("[data-analytics-hero]")?.dataset.analyticsHero;
    const collection = pathname.match(/\/catalog\/([a-z0-9-]+)$/)?.[1];
    send("page_view");
    if (currentCampaign) send("hero_impression", currentCampaign);
    if (collection) send("collection_visit", collection);
    if (pathname.includes("/catalog/products/")) send("product_view");

    const track = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-analytics-event]");
      const name = target?.dataset.analyticsEvent;
      if (!name) return;
      const campaign = target.dataset.analyticsCampaign;
      if (campaign) {
        try { sessionStorage.setItem(campaignKey, campaign); } catch { /* Storage can be disabled. */ }
      }
      send(name, campaign);
    };
    const custom = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "string") send(event.detail);
    };
    document.addEventListener("click", track);
    window.addEventListener(eventName, custom);
    return () => {
      document.removeEventListener("click", track);
      window.removeEventListener(eventName, custom);
    };
  }, [allowed, pathname, publicPage]);

  async function toggle() {
    setSaving(true);
    setError(false);
    try {
      const enabled = await setAnalyticsChoice(!allowed);
      if (!enabled) {
        try { sessionStorage.removeItem(campaignKey); } catch { /* Storage can be disabled. */ }
      }
      setAllowed(enabled);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return <div>
    <button type="button" aria-pressed={allowed} disabled={saving} onClick={toggle}>
      {fr ? "Mesure d’audience facultative" : "Optional audience measurement"}
    </button>
    {error && <p role="alert">{fr ? "Impossible d’enregistrer ce choix." : "Could not save your choice."}</p>}
  </div>;
}

export function selectedCampaign() {
  try { return sessionStorage.getItem(campaignKey) ?? undefined; } catch { return undefined; }
}

export function trackInteraction(event: "add_to_cart" | "checkout_start") {
  window.dispatchEvent(new CustomEvent(eventName, { detail: event }));
}
