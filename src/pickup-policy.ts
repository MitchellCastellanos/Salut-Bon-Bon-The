import { z } from "zod";

export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Day = typeof days[number];
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const interval = z.tuple([clock, z.union([clock, z.literal("24:00")])]).refine(([start, end]) => start < end);
const intervals = z.array(interval).max(4).refine(list => list.every((item, i) => i === 0 || list[i - 1][1] <= item[0]), "Intervals must not overlap");
const calendarDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine(value => { const d = new Date(`${value}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value); }, "Invalid date");

/** An exceptional schedule for a Montréal calendar date range. Later entries override earlier ones. */
export const exceptionSchema = z.object({
  from: calendarDate, to: calendarDate, closed: z.boolean(),
  hours: intervals.optional(), reason: z.string().trim().max(120).optional(),
}).refine(e => e.from <= e.to, "The range must end on or after it starts")
  .refine(e => e.closed || (e.hours?.length ?? 0) > 0, "Special hours need at least one interval");

export const pickupPolicySchema = z.object({
  /** Operational values stay unset until the business decides them; pickup is never offered while either is missing. */
  leadMinutes: z.number().int().min(5).max(1440).optional(),
  slotMinutes: z.number().int().refine(value => [5, 10, 15, 20, 30, 60].includes(value)).optional(),
  slotCapacity: z.number().int().min(1).max(500).optional(),
  advanceDays: z.number().int().min(1).max(60).optional(),
  sameDayCutoff: clock.nullable().optional(),
  hours: z.partialRecord(z.enum(days), intervals),
  /** Deprecated: tax lives in the fiscal settings (src/business.ts). Ignored if present. */
  taxRates: z.array(z.number().int().min(0).max(100000)).max(4).optional(),
  exceptions: z.array(exceptionSchema).max(200).optional(),
  /** Legacy single-date closures. Still honoured. */
  closedDates: z.array(calendarDate).max(120).optional(),
}).refine(policy => Object.values(policy.hours).some(hours => hours.length > 0), "Set opening hours for at least one day");

export type PickupPolicy = z.infer<typeof pickupPolicySchema>;
export type Exception = z.infer<typeof exceptionSchema>;
export type ReadyPickupPolicy = PickupPolicy & { leadMinutes: number; slotCapacity: number };
export const pickupParametersSet = (policy: PickupPolicy): policy is ReadyPickupPolicy =>
  policy.leadMinutes !== undefined && policy.slotCapacity !== undefined;

const local = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const minute = 60000;
const day = 24 * 60 * minute;

function localParts(time: number) {
  const p = Object.fromEntries(local.formatToParts(time).map(part => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, weekday: days.find(d => d === p.weekday)!, hour: Number(p.hour), minute: Number(p.minute) };
}
const clockOf = (minutes: number) => minutes >= 1440 ? "24:00" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const slotMinutes = (policy: PickupPolicy) => policy.slotMinutes ?? 15;
export const advanceDays = (policy: PickupPolicy) => policy.advanceDays ?? 7;

/** Opening intervals for a Montréal date: the last matching exception wins, otherwise the weekly schedule. */
export function intervalsFor(date: string, weekday: Day, policy: PickupPolicy): [string, string][] {
  if (policy.closedDates?.includes(date)) return [];
  const match = [...(policy.exceptions ?? [])].reverse().find(e => e.from <= date && date <= e.to);
  if (match) return match.closed ? [] : match.hours ?? [];
  return policy.hours[weekday] ?? [];
}

export function eligiblePickup(time: number, policy: PickupPolicy, now = Date.now()) {
  if (!pickupParametersSet(policy)) return false;
  const slot = slotMinutes(policy) * minute;
  if (!Number.isFinite(time) || time % slot || time < now + policy.leadMinutes * minute || time > now + advanceDays(policy) * day) return false;
  const at = localParts(time);
  if (policy.sameDayCutoff) {
    const current = localParts(now);
    if (at.date === current.date && clockOf(current.hour * 60 + current.minute) > policy.sameDayCutoff) return false;
  }
  const start = clockOf(at.hour * 60 + at.minute);
  const end = clockOf(at.hour * 60 + at.minute + slotMinutes(policy));
  return intervalsFor(at.date, at.weekday, policy).some(([opens, closes]) => start >= opens && end <= closes);
}

export function upcomingPickup(policy: PickupPolicy, now = Date.now()) {
  if (!pickupParametersSet(policy)) return [];
  const slot = slotMinutes(policy) * minute;
  const first = Math.ceil((now + policy.leadMinutes * minute) / slot) * slot;
  const slots: string[] = [];
  for (let time = first; time <= now + advanceDays(policy) * day; time += slot) {
    if (eligiblePickup(time, policy, now)) slots.push(new Date(time).toISOString());
  }
  return slots;
}

/** Whether pickup is open on a Montréal calendar date (ignores lead time and cutoff). Used for display. */
export function openOn(date: string, weekday: Day, policy: PickupPolicy) {
  return intervalsFor(date, weekday, policy).length > 0;
}

export function salesTax(subtotal: number, rates: number[]) {
  return rates.reduce((total, rate) => total + Math.round(subtotal * rate / 100000), 0);
}

/** The next `count` Montréal calendar days with their effective opening intervals, for the admin preview. */
export function scheduleOutlook(policy: PickupPolicy, count = 21, now = Date.now()) {
  const dateOf = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" });
  return Array.from({ length: count }, (_, i) => {
    const date = dateOf.format(now + i * day);
    const weekday = days[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
    const reason = policy.exceptions?.slice().reverse().find(e => e.from <= date && date <= e.to)?.reason;
    return { date, weekday, intervals: intervalsFor(date, weekday, policy), reason };
  });
}
