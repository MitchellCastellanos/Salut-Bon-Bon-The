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
