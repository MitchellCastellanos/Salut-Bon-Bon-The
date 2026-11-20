import { days, scheduleOutlook, type Day } from "../../../../src/pickup-policy";
import { pickupConfiguration } from "../../../../src/store-settings";
import { adminPage } from "../guard";
import { LiveNote, Notice, PageHeader } from "../ui";
import { OrderingSwitch } from "../ordering-switch";
import { HoursEditor } from "./hours-editor";
import { savePickupSettings } from "./actions";

export const metadata = { robots: { index: false, follow: false } };
const dayNames: Record<Day, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export default async function AdminHours({ params, searchParams }: PageProps<"/[lang]/admin/hours">) {
  const lang = await adminPage((await params).lang);
  const { error, saved } = await searchParams;
  const { policy, flag, blockers } = await pickupConfiguration();
  const week = Object.fromEntries(days.map(day => [day, { open: Boolean(policy?.hours[day]?.length), intervals: (policy?.hours[day] ?? []) as [string, string][] }]));
  const exceptions = (policy?.exceptions ?? []).map(e => ({ from: e.from, to: e.to, closed: e.closed, hours: (e.hours ?? []) as [string, string][], reason: e.reason ?? "" }));
  const upcoming = policy ? scheduleOutlook(policy) : [];
  return <section className="wrap">
    <PageHeader title="Hours and online ordering" intro="When the shop is open for pickup, how much time you need, and how many orders you can handle. Times are Montréal time."/>
    <Notice saved={saved} saves={{ hours: "Hours and pickup settings saved.", paused: "New online orders are paused. Customers now see that ordering is closed.", resumed: "Online ordering resumed." }}
      error={typeof error === "string" ? "x" : undefined} errors={{ x: String(error ?? "") }}/>
    <OrderingSwitch lang={lang} flag={flag} blockers={blockers} back="hours"/>
    <LiveNote>Saving applies to the website and checkout immediately. Orders already placed keep their pickup time.</LiveNote>
    <HoursEditor initialWeek={week} initialExceptions={exceptions} action={savePickupSettings.bind(null, lang)}
      settings={{ lead: policy?.leadMinutes?.toString() ?? "", slot: policy?.slotMinutes ?? 15, capacity: policy?.slotCapacity?.toString() ?? "", advance: policy?.advanceDays ?? 7, cutoff: policy?.sameDayCutoff ?? "" }}/>
    {policy && <><h2>What customers can pick over the next 21 days</h2>
      <ul className="catalog-grid">{upcoming.map(d => <li key={d.date}><strong>{d.date} · {dayNames[d.weekday]}</strong>
        <small>{d.intervals.length ? d.intervals.map(([a, b]) => `${a}–${b}`).join(", ") : "Closed"}{d.reason ? ` · ${d.reason}` : ""}</small></li>)}</ul></>}
  </section>;
}
