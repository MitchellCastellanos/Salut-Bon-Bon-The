"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { newQr } from "./actions";

export function QrCard({ lang, memberCode, logo, background }: { lang: "fr" | "en"; memberCode: string; logo?: string; background?: string }) {
  const fr = lang === "fr";
  const [qr, setQr] = useState<{ svg: string; expiresAt: string }>();
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  const loading = useRef(false);
  useEffect(() => {
    let current = true;
    loading.current = true;
    newQr(lang).then(result => {
      if (!current) return;
      if ("error" in result) setError(result.error === "RATE" ? fr ? "Trop de codes demandés. Réessayez dans quelques minutes." : "Too many codes requested. Try again in a few minutes." : fr ? "Impossible de générer le code." : "Could not generate the code.");
      else { setError(""); setQr(result); }
    }).finally(() => { loading.current = false; });
    return () => { current = false; };
  }, [lang, fr, version]);
  useEffect(() => {
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (qr && Date.parse(qr.expiresAt) <= time && !loading.current) setVersion(v => v + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [qr]);
  const left = qr ? Math.max(0, Math.round((Date.parse(qr.expiresAt) - now) / 1000)) : 0;
  const refresh = () => setVersion(v => v + 1);
  return <section className="panel rewards-card" aria-labelledby="qr-title" style={background ? { backgroundImage: `linear-gradient(rgba(255,248,239,.85), rgba(255,248,239,.85)), url(${background})`, backgroundSize: "cover" } : undefined}>
    <div className="rewards-card-head">{logo ? <Image src={logo} alt="Salut Bon Bon Thé" width={90} height={36} unoptimized/> : <strong>Salut Bon Bon Thé</strong>}</div>
    <h2 id="qr-title">{fr ? "Ma carte Récompenses Salut" : "My Salut Rewards card"}</h2>
    {qr ? <div className="qr" role="img" aria-label={fr ? "Code QR de la carte de fidélité" : "Loyalty card QR code"} dangerouslySetInnerHTML={{ __html: qr.svg }}/> : !error && <p role="status">{fr ? "Génération du code…" : "Generating code…"}</p>}
    {error && <p role="alert">{error}</p>}
    <p>{fr ? "Numéro de membre" : "Member number"} <strong className="member-code">{memberCode}</strong></p>
    <p className="fine-print" role="status">{qr ? (fr ? `Ce code est à usage unique et expire dans ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}.` : `This single-use code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}.`) : ""}</p>
    <button className="outline" type="button" onClick={refresh}>{fr ? "Nouveau code" : "New code"}</button>
  </section>;
}
