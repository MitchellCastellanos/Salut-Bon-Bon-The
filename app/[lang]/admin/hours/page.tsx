import Link from "next/link";
import { notFound } from "next/navigation";
import { language } from "../../../../src/domain";
import { days, scheduleOutlook, type Day } from "../../../../src/pickup-policy";
import { staffRole } from "../../../../src/staff";
import { pickupConfiguration } from "../../../../src/store-settings";
import { BlockerList } from "../blockers";
import { HoursEditor } from "./hours-editor";
import { savePickupSettings } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const dayNames: Record<Day, [string, string]> = { Mon: ["Lundi", "Monday"], Tue: ["Mardi", "Tuesday"], Wed: ["Mercredi", "Wednesday"], Thu: ["Jeudi", "Thursday"], Fri: ["Vendredi", "Friday"], Sat: ["Samedi", "Saturday"], Sun: ["Dimanche", "Sunday"] };

export default async function AdminHours({ params, searchParams }: PageProps<"/[lang]/admin/hours">) {
  const { lang } = await params;
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") notFound();
  const fr = lang === "fr";
  const { error, saved } = await searchParams;
  const { policy, flag: enabled, blockers } = await pickupConfiguration();
  const week = Object.fromEntries(days.map(day => [day, { open: Boolean(policy?.hours[day]?.length), intervals: (policy?.hours[day] ?? []) as [string, string][] }]));
  const exceptions = (policy?.exceptions ?? []).map(e => ({ from: e.from, to: e.to, closed: e.closed, hours: (e.hours ?? []) as [string, string][], reason: e.reason ?? "" }));
  const upcoming = policy ? scheduleOutlook(policy) : [];
  return <section className="wrap catalog-page">
    <Link href={`/${lang}/admin`}>{fr ? "Administration" : "Administration"}</Link>
    <h1>{fr ? "Heures d’ouverture et cueillette" : "Business hours and pickup"}</h1>
    <p>{fr ? "Fuseau horaire : America/Toronto. Aucune heure officielle n’est prédéfinie : tout est fermé jusqu’à l’enregistrement. Les changements s’appliquent immédiatement, sans redéploiement." : "Time zone: America/Toronto. No official hours are predefined: everything is closed until you save. Changes apply immediately, with no redeploy."}</p>
    {blockers.length > 0 && <BlockerList lang={lang} blockers={blockers}/>}
    {saved && <p role="status" className="panel">{fr ? "Horaire enregistré." : "Schedule saved."}</p>}
    {typeof error === "string" && <p role="alert" className="panel">{error}</p>}
    <HoursEditor lang={lang} initialWeek={week} initialExceptions={exceptions} enabled={enabled} action={savePickupSettings.bind(null, lang)}
      settings={{ lead: policy?.leadMinutes?.toString() ?? "", slot: policy?.slotMinutes ?? 15, capacity: policy?.slotCapacity?.toString() ?? "", advance: policy?.advanceDays ?? 7, cutoff: policy?.sameDayCutoff ?? "" }}/>
    {policy && <><h2>{fr ? "Les 21 prochains jours" : "Next 21 days"}</h2>
      <ul className="catalog-grid">{upcoming.map(d => <li key={d.date}><strong>{d.date} · {dayNames[d.weekday][fr ? 0 : 1]}</strong>
        <small>{d.intervals.length ? d.intervals.map(([a, b]) => `${a}–${b}`).join(", ") : (fr ? "Fermé" : "Closed")}{d.reason ? ` · ${d.reason}` : ""}</small></li>)}</ul></>}
  </section>;
}
