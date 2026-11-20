"use client";

import { useEffect, useState } from "react";
import { Submit } from "../submit";

type Interval = [string, string];
type Exception = { from: string; to: string; closed: boolean; hours: Interval[]; reason: string };
type Week = Record<string, { open: boolean; intervals: Interval[] }>;
const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const names: Record<string, [string, string]> = { Mon: ["Lundi", "Monday"], Tue: ["Mardi", "Tuesday"], Wed: ["Mercredi", "Wednesday"], Thu: ["Jeudi", "Thursday"], Fri: ["Vendredi", "Friday"], Sat: ["Samedi", "Saturday"], Sun: ["Dimanche", "Sunday"] };
const minutes = (t: string) => t === "24:00" ? 1440 : Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export function HoursEditor({ initialWeek, initialExceptions, settings, action }: {
  initialWeek: Week; initialExceptions: Exception[];
  settings: { lead: string; slot: number; capacity: string; advance: number; cutoff: string };
  action: (form: FormData) => void;
}) {
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
    {dirty && <p role="status" className="panel">Unsaved changes.</p>}
    <fieldset className="panel"><legend>Weekly opening hours (Montréal time)</legend>
      {order.map(day => {
        const d = week[day];
        return <div key={day} className="hours-row">
          <label className="hours-day"><input type="checkbox" name={`${day}_open`} checked={d.open} onChange={event => toggle(day, event.target.checked)}/> <strong>{names[day][1]}</strong> <span>{d.open ? "Open" : "Closed"}</span></label>
          {d.open && <div className="hours-intervals">{d.intervals.map((pair, i) => <span key={i} className="hours-interval">
            <input type="time" name={`${day}_${i}_start`} value={pair[0]} required onChange={event => setInterval(day, i, 0, event.target.value)} aria-label={`${names[day][1]} opens ${i + 1}`}/>
            <input type="time" name={`${day}_${i}_end`} value={pair[1]} required onChange={event => setInterval(day, i, 1, event.target.value)} aria-label={`${names[day][1]} closes ${i + 1}`}/>
            {d.intervals.length > 1 && <button type="button" className="outline" onClick={() => removeInterval(day, i)} aria-label="Remove interval">×</button>}
          </span>)}
            {d.intervals.length < 4 && <button type="button" className="outline" onClick={() => addInterval(day)}>+ Interval</button>}</div>}
          <div className="hours-bar" role="img" aria-label={d.open ? d.intervals.filter(([a, b]) => a && b).map(([a, b]) => `${a}–${b}`).join(", ") || "No hours" : "Closed"}>
            {d.open && d.intervals.filter(([a, b]) => a && b && minutes(a) < minutes(b === "00:00" ? "24:00" : b)).map(([a, b], i) => <span key={i} style={{ left: `${minutes(a) / 14.4}%`, width: `${(minutes(b === "00:00" ? "24:00" : b) - minutes(a)) / 14.4}%` }}/>)}
          </div>
        </div>;
      })}
      <div className="hours-scale" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
    </fieldset>
    <fieldset className="panel"><legend>Pickup rules</legend>
      <p className="fine-print">Preparation time and orders per time slot start empty on purpose: online pickup is not offered until you set them.</p>
      <label>Preparation time (minutes before the earliest pickup)<input name="lead" type="number" min={5} max={1440} defaultValue={settings.lead}/></label>
      <label>Length of a pickup time slot<select name="slot" defaultValue={settings.slot}>{[5, 10, 15, 20, 30, 60].map(v => <option key={v} value={v}>{v} min</option>)}</select></label>
      <label>Maximum orders per pickup time slot<input name="capacity" type="number" min={1} max={500} defaultValue={settings.capacity}/></label>
      <label>How many days ahead customers can order<input name="advance" type="number" min={1} max={60} defaultValue={settings.advance} required/></label>
      <label>Last time to order for the same day (optional)<input name="cutoff" type="time" defaultValue={settings.cutoff}/></label>
    </fieldset>
    <fieldset className="panel" id="closures"><legend>Exceptional schedules (closures, holidays, special hours)</legend>
      {exceptions.map((e, i) => <div key={i} className="hours-row">
        <label>From<input type="date" value={e.from} required onChange={event => patch(i, { from: event.target.value, to: e.to && e.to >= event.target.value ? e.to : event.target.value })}/></label>
        <label>To (inclusive)<input type="date" value={e.to} min={e.from} required onChange={event => patch(i, { to: event.target.value })}/></label>
        <label>Type<select value={e.closed ? "closed" : "special"} onChange={event => patch(i, { closed: event.target.value === "closed", hours: event.target.value === "closed" ? e.hours : e.hours.length ? e.hours : [["", ""]] })}>
          <option value="closed">Closed</option><option value="special">Special hours</option></select></label>
        {!e.closed && <span className="hours-interval"><input type="time" value={e.hours[0]?.[0] ?? ""} required onChange={event => patch(i, { hours: [[event.target.value, e.hours[0]?.[1] ?? ""]] })} aria-label="Special opening"/>
          <input type="time" value={e.hours[0]?.[1] ?? ""} required onChange={event => patch(i, { hours: [[e.hours[0]?.[0] ?? "", event.target.value]] })} aria-label="Special closing"/></span>}
        <label>Reason (optional)<input value={e.reason} maxLength={120} onChange={event => patch(i, { reason: event.target.value })}/></label>
        <button type="button" className="outline" onClick={() => { touch(); setExceptions(list => list.filter((_, j) => j !== i)); }}>Remove</button>
      </div>)}
      <button type="button" className="outline" onClick={() => { touch(); setExceptions(list => [...list, { from: "", to: "", closed: true, hours: [], reason: "" }]); }}>+ Add a closure or special schedule</button>
      <input type="hidden" name="exceptions" value={serial}/>
    </fieldset>
    <Submit>Save hours and pickup settings</Submit>
  </form>;
}
