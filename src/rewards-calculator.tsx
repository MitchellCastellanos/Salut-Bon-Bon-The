"use client";
import { useId, useState } from "react";
import { parseDollars, pointsFor, progress, spendToEarn, valueCents } from "./rewards-math";

export type CalculatorTerms = { pointsPerDollar: number; rewardCost: number; rewardCents: number; preview: boolean; lang: "fr" | "en" };

/** Hypothetical-spend simulator. It uses the terms the server read from the real program configuration; nothing is sent anywhere. */
export function RewardsCalculator({ pointsPerDollar, rewardCost, rewardCents, preview, lang }: CalculatorTerms) {
  const fr = lang === "fr";
  const id = useId();
  const [text, setText] = useState("");
  const cents = parseDollars(text);
  const points = cents ? pointsFor(cents, pointsPerDollar) : 0;
  const value = valueCents(points, { pointsCost: rewardCost, discountCents: rewardCents });
  const { share, missing } = progress(points, rewardCost);
  const more = spendToEarn(missing, pointsPerDollar);
  const nf = new Intl.NumberFormat(fr ? "fr-CA" : "en-CA");
  const money = (c: number) => new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", { style: "currency", currency: "CAD" }).format(c / 100);
  const invalid = text.trim() !== "" && cents === undefined;
  return <div className="rw-calc" data-testid="calculator">
    <form onSubmit={event => event.preventDefault()} noValidate>
      <label htmlFor={id}>{fr ? "Montant d’achat admissible, avant taxes (exemple)" : "Eligible purchase amount, before tax (example)"}</label>
      <div className="rw-input"><span aria-hidden="true">$</span>
        <input id={id} inputMode="decimal" autoComplete="off" placeholder={fr ? "ex. 20,00" : "e.g. 20.00"} value={text} maxLength={9}
          aria-invalid={invalid} aria-describedby={`${id}-help`} onChange={event => setText(event.target.value)}/></div>
      <p id={`${id}-help`} className={invalid ? "rw-error" : "fine-print"} role={invalid ? "alert" : undefined}>
        {invalid ? (fr ? "Entrez un montant valide (ex. 12,50)." : "Enter a valid amount (e.g. 12.50).") :
          (fr ? "Simulation : vous choisissez le montant. Aucune donnée personnelle n’est utilisée." : "Simulation: you choose the amount. No personal data is used.")}</p>
    </form>
    <div className="rw-results" role="status" aria-live="polite">
      {cents ? <>
        <p className="rw-big"><strong>{nf.format(points)}</strong> {fr ? "points" : "points"}</p>
        <p>{fr ? "Valeur équivalente" : "Equivalent value"} : <strong>{money(value)}</strong></p>
        <div className="rw-meter" role="progressbar" aria-valuemin={0} aria-valuemax={rewardCost} aria-valuenow={Math.min(points, rewardCost)}
          aria-label={fr ? `Progrès vers ${nf.format(rewardCost)} points` : `Progress toward ${nf.format(rewardCost)} points`}><i style={{ width: `${Math.round(share * 100)}%` }}/></div>
        <p>{missing === 0 ? (fr ? `Ce montant suffirait pour une récompense de ${money(rewardCents)}.` : `This amount would be enough for a ${money(rewardCents)} reward.`) :
          (fr ? `Il manquerait ${nf.format(missing)} points (environ ${money(more)} d’achats admissibles de plus) pour atteindre ${nf.format(rewardCost)} points.` :
            `You would be ${nf.format(missing)} points short (about ${money(more)} more in eligible purchases) of ${nf.format(rewardCost)} points.`)}</p>
      </> : <p className="fine-print">{fr ? "Entrez un montant pour voir vos points." : "Enter an amount to see your points."}</p>}
      {preview && <p className="rw-preview-note">{fr ? "Aperçu : le programme n’est pas encore actif. Cette simulation n’accumule aucun point réel." : "Preview: the program is not active yet. This simulation earns no real points."}</p>}
    </div>
  </div>;
}
