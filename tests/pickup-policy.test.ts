import { expect, it } from "vitest";
import { eligiblePickup, salesTax, upcomingPickup, type PickupPolicy } from "../src/pickup-policy";

const policy: PickupPolicy = {
  leadMinutes: 30,
  slotCapacity: 2,
  hours: { Wed: [["10:00", "11:00"]] },
  taxRates: [5000, 9500],
};
const now = Date.parse("2026-11-18T14:45:00Z");

it("uses Montréal hours, the lead time, and intervals that end before closing", () => {
  expect(upcomingPickup(policy, now).slice(0, 3)).toEqual([
    "2026-11-18T15:15:00.000Z",
    "2026-11-18T15:30:00.000Z",
    "2026-11-18T15:45:00.000Z",
  ]);
  expect(eligiblePickup(Date.parse("2026-11-18T15:00:00Z"), policy, now)).toBe(false);
  expect(eligiblePickup(Date.parse("2026-11-18T16:00:00Z"), policy, now)).toBe(false);
});

it("rounds separately for each configured tax", () => {
  expect(salesTax(777, policy.taxRates)).toBe(39 + 74);
});

it("offers no pickup on an exceptional closure date in Montréal local time", () => {
  const closed = { ...policy, closedDates: ["2026-11-18"] };
  const slot = Date.parse("2026-11-18T15:30:00Z"); // 10:30 in Montréal
  expect(eligiblePickup(slot, policy, now)).toBe(true);
  expect(eligiblePickup(slot, closed, now)).toBe(false);
  expect(upcomingPickup(closed, now).some(time => time.startsWith("2026-11-18"))).toBe(false);
  // 23:30 in Montréal on the 17th is already the 18th in UTC; the local date must decide.
  expect(eligiblePickup(Date.parse("2026-11-18T04:30:00Z"), { ...policy, hours: { Tue: [["23:00", "24:00"]] }, closedDates: ["2026-11-18"] }, Date.parse("2026-11-17T20:00:00Z"))).toBe(true);
});

import { pickupPolicySchema, intervalsFor } from "../src/pickup-policy";

const week: PickupPolicy = { leadMinutes: 15, slotCapacity: 3, taxRates: [], hours: { Mon: [["09:00", "12:00"]], Tue: [["09:00", "17:00"]] } };

it("honours Montréal daylight saving time on both transitions", () => {
  // Mon 2026-03-09 09:00 is EDT (13:00Z). Mon 2026-03-02 09:00 was still EST (14:00Z).
  const before = Date.parse("2026-02-28T12:00:00Z"), after = Date.parse("2026-03-07T12:00:00Z");
  expect(eligiblePickup(Date.parse("2026-03-02T14:00:00Z"), week, before)).toBe(true);
  expect(eligiblePickup(Date.parse("2026-03-02T13:00:00Z"), week, before)).toBe(false);
  expect(eligiblePickup(Date.parse("2026-03-09T13:00:00Z"), week, after)).toBe(true);
  expect(eligiblePickup(Date.parse("2026-03-09T14:00:00Z"), week, after)).toBe(true);
  expect(eligiblePickup(Date.parse("2026-03-09T12:45:00Z"), week, after)).toBe(false);
  // Fall back: Mon 2026-11-02 09:00 is EST (14:00Z); the Monday before (Oct 26) was EDT (13:00Z).
  expect(eligiblePickup(Date.parse("2026-10-26T13:00:00Z"), week, Date.parse("2026-10-24T12:00:00Z"))).toBe(true);
  expect(eligiblePickup(Date.parse("2026-11-02T14:00:00Z"), week, Date.parse("2026-10-31T12:00:00Z"))).toBe(true);
  expect(eligiblePickup(Date.parse("2026-11-02T13:00:00Z"), week, Date.parse("2026-10-31T12:00:00Z"))).toBe(false);
});

it("supports configurable slot length, advance window and same-day cutoff", () => {
  const now = Date.parse("2026-11-17T13:00:00Z"); // Tue 08:00 Montréal
  const hourly = { ...week, slotMinutes: 60 as const, advanceDays: 1 };
  expect(eligiblePickup(Date.parse("2026-11-17T15:00:00Z"), hourly, now)).toBe(true);   // 10:00
  expect(eligiblePickup(Date.parse("2026-11-17T15:15:00Z"), hourly, now)).toBe(false);  // not on the hour
  expect(eligiblePickup(Date.parse("2026-11-19T15:00:00Z"), hourly, now)).toBe(false);  // beyond 1 day
  const cutoff = { ...week, sameDayCutoff: "09:00" };
  expect(eligiblePickup(Date.parse("2026-11-17T20:00:00Z"), cutoff, now)).toBe(true);   // before the cutoff
  expect(eligiblePickup(Date.parse("2026-11-17T20:00:00Z"), cutoff, Date.parse("2026-11-17T14:30:00Z"))).toBe(false); // 09:30 > cutoff
  expect(eligiblePickup(Date.parse("2026-11-24T20:00:00Z"), cutoff, Date.parse("2026-11-17T14:30:00Z"))).toBe(false); // outside 7 days
});

it("applies date-range closures and special hours, last entry winning, with reasons optional", () => {
  const now = Date.parse("2026-12-20T12:00:00Z");
  const policy: PickupPolicy = { ...week, hours: { Fri: [["09:00", "17:00"]], Thu: [["09:00", "17:00"]], Mon: [["09:00", "17:00"]] }, exceptions: [
    { from: "2026-12-24", to: "2026-12-26", closed: true, reason: "Holidays" },
    { from: "2026-12-25", to: "2026-12-25", closed: false, hours: [["12:00", "14:00"]] },
  ] };
  expect(intervalsFor("2026-12-24", "Thu", policy)).toEqual([]);
  expect(intervalsFor("2026-12-25", "Fri", policy)).toEqual([["12:00", "14:00"]]);
  expect(eligiblePickup(Date.parse("2026-12-25T17:30:00Z"), policy, now)).toBe(true);   // 12:30 special hours
  expect(eligiblePickup(Date.parse("2026-12-25T15:30:00Z"), policy, now)).toBe(false);  // 10:30 outside special hours
  expect(eligiblePickup(Date.parse("2026-12-24T17:00:00Z"), policy, now)).toBe(false);  // closure range
  expect(upcomingPickup(policy, now).some(slot => slot.startsWith("2026-12-26"))).toBe(false);
});

it("validates the policy: overlapping intervals, bad dates, ranges, empty weeks and special hours are rejected", () => {
  const ok = { leadMinutes: 15, slotCapacity: 2, taxRates: [], hours: { Mon: [["09:00", "12:00"], ["13:00", "17:00"]] } };
  expect(pickupPolicySchema.safeParse(ok).success).toBe(true);
  expect(pickupPolicySchema.safeParse({ ...ok, hours: { Mon: [["09:00", "12:00"], ["11:00", "13:00"]] } }).success).toBe(false);
  expect(pickupPolicySchema.safeParse({ ...ok, hours: { Mon: [] } }).success).toBe(false);
  expect(pickupPolicySchema.safeParse({ ...ok, slotMinutes: 7 }).success).toBe(false);
  expect(pickupPolicySchema.safeParse({ ...ok, exceptions: [{ from: "2026-02-30", to: "2026-03-01", closed: true }] }).success).toBe(false);
  expect(pickupPolicySchema.safeParse({ ...ok, exceptions: [{ from: "2026-03-05", to: "2026-03-01", closed: true }] }).success).toBe(false);
  expect(pickupPolicySchema.safeParse({ ...ok, exceptions: [{ from: "2026-03-01", to: "2026-03-01", closed: false }] }).success).toBe(false);
});
