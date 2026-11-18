import { z } from "zod";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const interval = z.tuple([clock, z.union([clock, z.literal("24:00")])])
  .refine(([start, end]) => start < end);

export const pickupPolicySchema = z.object({
  leadMinutes: z.number().int().min(15).max(1440),
  slotCapacity: z.number().int().min(1).max(500),
  hours: z.partialRecord(z.enum(days), z.array(interval).max(4)),
  taxRates: z.array(z.number().int().min(0).max(100000)).max(4),
  /** Exceptional closures as Montréal calendar dates (YYYY-MM-DD). No pickup is offered or accepted on them. */
  closedDates: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)).max(120).optional(),
}).refine(policy => Object.values(policy.hours).some(hours => hours.length > 0));

export type PickupPolicy = z.infer<typeof pickupPolicySchema>;

const toronto = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" });
const quarter = 15 * 60000;
const day = 24 * 60 * 60000;

export function eligiblePickup(time: number, policy: PickupPolicy, now = Date.now()) {
  if (!Number.isFinite(time) || (time % quarter) || time < now + policy.leadMinutes * 60000 || time > now + 7 * day) return false;
  if (policy.closedDates?.includes(localDate.format(time))) return false;
  const parts = Object.fromEntries(toronto.formatToParts(time).map(part => [part.type, part.value]));
  const start = `${parts.hour}:${parts.minute}`;
  const endMinutes = Number(parts.hour) * 60 + Number(parts.minute) + 15;
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  const weekday = days.find(day => day === parts.weekday);
  return Boolean(weekday && policy.hours[weekday]?.some(([opens, closes]) => start >= opens && end <= closes));
}

export function upcomingPickup(policy: PickupPolicy, now = Date.now()) {
  const first = Math.ceil((now + policy.leadMinutes * 60000) / quarter) * quarter;
  const slots: string[] = [];
  for (let time = first; time <= now + 7 * day; time += quarter) {
    if (eligiblePickup(time, policy, now)) slots.push(new Date(time).toISOString());
  }
  return slots;
}

export function salesTax(subtotal: number, rates: number[]) {
  return rates.reduce((total, rate) => total + Math.round(subtotal * rate / 100000), 0);
}
