# Business hours, closures and pickup scheduling

Time zone: **America/Toronto** for every rule. All checks run on the server in `eligiblePickup` (`src/pickup-policy.ts`); the browser only displays the slots the server computed. Changes made in `/{lang}/admin/hours` take effect immediately, with no redeploy (settings are read per request from `catalog_store_settings`).

**Nothing is predefined.** No official hours, capacity or lead time exist in the repository. Until an ADMIN saves a schedule with at least one open interval, no pickup slot is offered and checkout is unavailable.

## What the owner can configure

- **Weekly hours:** per weekday an open/closed toggle and up to four non-overlapping intervals (for example 08:00–12:00 and 13:00–22:00). A bar per day draws the schedule; the form warns about unsaved changes.
- **Pickup:** preparation lead time (5–1440 min), slot length (5, 10, 15, 20, 30 or 60 min), maximum orders per slot, advance booking window (1–60 days), optional same-day cutoff time.
- **Exceptional schedules:** date ranges that are either **closed** or have **special hours**, each with an optional reason. Later entries override earlier ones, and a range overrides the weekly schedule for those dates. This covers holidays, single closure dates, temporary closures, date ranges and special opening hours.
- **Sales tax rates** (percent, up to two) and the **pickup ordering enabled** switch. See [Tax](TAX.md).

The page also lists the next 21 days exactly as customers will see them, so the effect of exceptions is visible.

## Enforcement

A pickup time is accepted only if all of these hold, evaluated by the server at order time:

1. It is on a slot boundary for the configured slot length.
2. It is at least the lead time from now and no more than the advance window ahead.
3. If a same-day cutoff is set and the pickup is today (Montréal date), the current Montréal time is not past the cutoff.
4. The whole slot lies inside an open interval for that Montréal date: the last matching exception if any (closed means no pickup), otherwise the weekly schedule.
5. The slot has fewer than the maximum orders. Capacity is enforced with a per-slot PostgreSQL advisory transaction lock, so concurrent orders cannot oversell a slot.

Closed days therefore offer no slots, and a forged slot time is refused (`SLOT`). Slots are computed from UTC multiples of the slot length and converted with the `America/Toronto` zone rules, so the March and November daylight-saving changes shift local hours correctly.

## Verification

`tests/pickup-policy.test.ts` (both DST transitions, slot length, advance window, cutoff, ranges and special hours, validation), `tests/pickup-capacity.test.ts` (real PostgreSQL: 12 parallel orders for a capacity-2 slot give exactly 2 orders; duplicate request ids collapse; forged slots refused) and the admin hours steps of `tests/rewards-browser-smoke.mjs`.

Legacy policies (`closedDates`, 15-minute slots, 7-day window) still validate and behave as before.
