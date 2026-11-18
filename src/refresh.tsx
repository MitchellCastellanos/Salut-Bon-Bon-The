"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "./domain";

export function Refresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  return null;
}
export function CopyLink({ lang }: { lang: Lang }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const fr = lang === "fr";
  return <div>
    <button type="button" className="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(window.location.href); setStatus("copied"); }
      catch { setStatus("manual"); }
    }}>{fr ? "Copier le lien privé" : "Copy private link"}</button>
    <p role="status">{status === "copied" ? fr ? "Lien copié." : "Link copied." : status === "manual" ? fr ? "Copie le lien dans la barre d’adresse." : "Copy the link from your address bar." : ""}</p>
  </div>;
}
