"use client";

import { useEffect, useState } from "react";

type Interval = [string, string];
type Exception = { from: string; to: string; closed: boolean; hours: Interval[]; reason: string };
type Week = Record<string, { open: boolean; intervals: Interval[] }>;
const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const names: Record<string, [string, string]> = { Mon: ["Lundi", "Monday"], Tue: ["Mardi", "Tuesday"], Wed: ["Mercredi", "Wednesday"], Thu: ["Jeudi", "Thursday"], Fri: ["Vendredi", "Friday"], Sat: ["Samedi", "Saturday"], Sun: ["Dimanche", "Sunday"] };
const minutes = (t: string) => t === "24:00" ? 1440 : Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export function HoursEditor({ lang, initialWeek, initialExceptions, settings, action, enabled }: {
  lang: "fr" | "en"; initialWeek: Week; initialExceptions: Exception[]; enabled: boolean;
  settings: { lead: number; slot: number; capacity: number; advance: number; cutoff: string; tax1: string; tax2: string };
  action: (form: FormData) => void;
}) {
  const fr = lang === "fr";
  const [week, setWeek] = useState(initialWeek);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const touch = () => setDirty(true);
  const setInterval = (day: string, index: number, part: 0 | 1, value: string) => { touch(); setWeek(w => ({ ...w, [day]: { ...w[day], intervals: w[day].intervals.map((pair, i) => i === index ? (part === 0 ? [value, pair[1]] : [pair[0], value]) as Interval : pair) } })); };
  const toggle = (day: string, open: boolean) => { touch(); setWeek(w => ({ ...w, [day]: { open, intervals: open && !w[day].intervals.length ? [["", ""]] : w[day].intervals } })); };
  const addInterval = (day: string) => { touch(); setWeek(w => ({ ...w, [day]: { ...w[day], intervals: [...w[day].intervals, ["", ""]].slice(0, 4) as Interval[] } })); };
  const removeInterval = (day: string, index: number) => { touch(); setWeek(w => ({ ...w, [day]: { ...w[day], intervals: w[day].intervals.filter((_, i) => i !== index) } })); };
  const patch = (index: number, change: Partial<Exception>) => { touch(); setExceptions(list => list.map((e, i) => i === index ? { ...e, ...change } : e)); };
  const serial = JSON.stringify(exceptions.map(e => ({ from: e.from, to: e.to || e.from, closed: e.closed, ...(e.closed ? {} : { hours: e.hours.filter(([a, b]) => a && b) }), ...(e.reason ? { reason: e.reason } : {}) })));
  return <form action={action} onSubmit={() => setDirty(false)} onChange={touch} className="hours-editor">
    {dirty && <p role="status" className="panel">{fr ? "Modifications non enregistrées." : "Unsaved changes."}</p>}
    <fieldset className="panel"><legend>{fr ? "Heures d’ouverture hebdomadaires (heure de Montréal)" : "Weekly opening hours (Montréal time)"}</legend>
      {order.map(day => {
        const d = week[day];
        return <div key={day} className="hours-row">
          <label className="hours-day"><input type="checkbox" name={`${day}_open`} checked={d.open} onChange={event => toggle(day, event.target.checked)}/> <strong>{names[day][fr ? 0 : 1]}</strong> <span>{d.open ? (fr ? "Ouvert" : "Open") : (fr ? "Fermé" : "Closed")}</span></label>
          {d.open && <div className="hours-intervals">{d.intervals.map((pair, i) => <span key={i} className="hours-interval">
            <input type="time" name={`${day}_${i}_start`} value={pair[0]} required onChange={event => setInterval(day, i, 0, event.target.value)} aria-label={`${names[day][fr ? 0 : 1]} ${fr ? "ouverture" : "opens"} ${i + 1}`}/>
            <input type="time" name={`${day}_${i}_end`} value={pair[1]} required onChange={event => setInterval(day, i, 1, event.target.value)} aria-label={`${names[day][fr ? 0 : 1]} ${fr ? "fermeture" : "closes"} ${i + 1}`}/>
            {d.intervals.length > 1 && <button type="button" className="outline" onClick={() => removeInterval(day, i)} aria-label={fr ? "Retirer l’intervalle" : "Remove interval"}>×</button>}
          </span>)}
            {d.intervals.length < 4 && <button type="button" className="outline" onClick={() => addInterval(day)}>{fr ? "+ Intervalle" : "+ Interval"}</button>}</div>}
          <div className="hours-bar" role="img" aria-label={d.open ? d.intervals.filter(([a, b]) => a && b).map(([a, b]) => `${a}–${b}`).join(", ") || (fr ? "Aucune heure" : "No hours") : (fr ? "Fermé" : "Closed")}>
            {d.open && d.intervals.filter(([a, b]) => a && b && minutes(a) < minutes(b === "00:00" ? "24:00" : b)).map(([a, b], i) => <span key={i} style={{ left: `${minutes(a) / 14.4}%`, width: `${(minutes(b === "00:00" ? "24:00" : b) - minutes(a)) / 14.4}%` }}/>)}
          </div>
        </div>;
      })}
      <div className="hours-scale" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </fieldset>
    <fieldset className="panel"><legend>{fr ? "Cueillette" : "Pickup"}</legend>
      <label>{fr ? "Délai de préparation (minutes)" : "Preparation lead time (minutes)"}<input name="lead" type="number" min={5} max={1440} defaultValue={settings.lead} required/></label>
      <label>{fr ? "Durée d’une plage" : "Slot length"}<select name="slot" defaultValue={settings.slot}>{[5, 10, 15, 20, 30, 60].map(v => <option key={v} value={v}>{v} min</option>)}</select></label>
      <label>{fr ? "Commandes maximales par plage" : "Maximum orders per slot"}<input name="capacity" type="number" min={1} max={500} defaultValue={settings.capacity} required/></label>
      <label>{fr ? "Réservation à l’avance (jours)" : "Advance booking window (days)"}<input name="advance" type="number" min={1} max={60} defaultValue={settings.advance} required/></label>
      <label>{fr ? "Heure limite pour commander le jour même (facultatif)" : "Same-day ordering cutoff (optional)"}<input name="cutoff" type="time" defaultValue={settings.cutoff}/></label>
    </fieldset>
    <fieldset className="panel"><legend>{fr ? "Taxes de vente (%)" : "Sales taxes (%)"}</legend>
      <label>{fr ? "Taxe 1 (ex. TPS)" : "Tax 1 (e.g. GST)"}<input name="tax1" inputMode="decimal" pattern="\d{1,2}(\.\d{1,3})?" defaultValue={settings.tax1}/></label>
      <label>{fr ? "Taxe 2 (ex. TVQ)" : "Tax 2 (e.g. QST)"}<input name="tax2" inputMode="decimal" pattern="\d{1,2}(\.\d{1,3})?" defaultValue={settings.tax2}/></label>
      <p className="fine-print">{fr ? "Laissez vide tant que l’inscription et le traitement fiscal ne sont pas confirmés." : "Leave blank until registration and tax treatment are confirmed."}</p>
    </fieldset>
    <fieldset className="panel"><legend>{fr ? "Horaires exceptionnels (fermetures, congés, heures spéciales)" : "Exceptional schedules (closures, holidays, special hours)"}</legend>
      {exceptions.map((e, i) => <div key={i} className="hours-row">
        <label>{fr ? "Du" : "From"}<input type="date" value={e.from} required onChange={event => patch(i, { from: event.target.value, to: e.to && e.to >= event.target.value ? e.to : event.target.value })}/></label>
        <label>{fr ? "Au (inclus)" : "To (inclusive)"}<input type="date" value={e.to} min={e.from} required onChange={event => patch(i, { to: event.target.value })}/></label>
        <label>{fr ? "Type" : "Type"}<select value={e.closed ? "closed" : "special"} onChange={event => patch(i, { closed: event.target.value === "closed", hours: event.target.value === "closed" ? e.hours : e.hours.length ? e.hours : [["", ""]] })}>
          <option value="closed">{fr ? "Fermé" : "Closed"}</option><option value="special">{fr ? "Heures spéciales" : "Special hours"}</option></select></label>
        {!e.closed && <span className="hours-interval"><input type="time" value={e.hours[0]?.[0] ?? ""} required onChange={event => patch(i, { hours: [[event.target.value, e.hours[0]?.[1] ?? ""]] })} aria-label={fr ? "Ouverture spéciale" : "Special opening"}/>
          <input type="time" value={e.hours[0]?.[1] ?? ""} required onChange={event => patch(i, { hours: [[e.hours[0]?.[0] ?? "", event.target.value]] })} aria-label={fr ? "Fermeture spéciale" : "Special closing"}/></span>}
        <label>{fr ? "Motif (facultatif)" : "Reason (optional)"}<input value={e.reason} maxLength={120} onChange={event => patch(i, { reason: event.target.value })}/></label>
        <button type="button" className="outline" onClick={() => { touch(); setExceptions(list => list.filter((_, j) => j !== i)); }}>{fr ? "Retirer" : "Remove"}</button>
      </div>)}
      <button type="button" className="outline" onClick={() => { touch(); setExceptions(list => [...list, { from: "", to: "", closed: true, hours: [], reason: "" }]); }}>{fr ? "+ Ajouter une fermeture ou un horaire spécial" : "+ Add a closure or special schedule"}</button>
      <input type="hidden" name="exceptions" value={serial}/>
    </fieldset>
    <label className="panel"><input type="checkbox" name="enabled" defaultChecked={enabled}/> {fr ? "Commandes pour cueillette activées (après approbation de mise en service)" : "Pickup ordering enabled (after launch approval)"}</label>
    <button className="button">{fr ? "Enregistrer l’horaire" : "Save schedule"}</button>
  </form>;
}
