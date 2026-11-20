# Architecture decisions

## 2026-11-17 · PostgreSQL in the demo and deployed design

Accepted for the first slice. Use PGlite with a local data directory for a portable demo and the PostgreSQL driver for Neon connectivity. A local server would add provisioning work and memory-only storage would lose orders. SQL lives in versioned files. Prisma remains planned. See the staff authentication decision below. The demo driver is single-process and requires writable disk.

## 2026-11-17 · Individual staff sessions

Use Better Auth with the shared pg pool and versioned SQL. Keep credential provisioning operator-only and require STAFF or ADMIN for staff sessions and order operations. This retains the existing PostgreSQL deployment path and avoids adding an ORM just for authentication. The independent demo cookie remains available for the private credential-free workflow. Current roles are read with every staff authorization check so demotion takes effect for existing sessions. Both roles handle orders. Reserve store settings and other upcoming management operations for ADMIN.

## 2026-11-18 · Salut Rewards 5 % reuses the existing ledger; guest cards instead of receipt claims

Option B (10 points per $1, 1,000 points = $5) is the preview program; option A (9 + 1) is proposal only. The existing PostgreSQL ledger and QR engine are extended, not replaced. Rounding is `floor` once per order on integer cents. Preview visibility, earning, redemption and commercial authorization are separate flags; `active` stays the master switch and production activation needs the recorded authorization. The $5 reward is a counter-applied discount: online checkout totals are never changed. Guests participate with a random-secret **guest card** (hash at rest, httpOnly cookie, backup code, rate limited, linkable to an account by moving points through the ledger); claiming points from a receipt or tracking link and phone-number identification were rejected as unsafe (a shared link or a guessable value would let someone else claim purchases). Refund reversal is cumulative and proportional, never drives balances negative and records any unrecoverable shortfall. Loyalty details are never shown on private tracking links.

## 2026-11-19 · Stamp card (9 + 1) replaces the points scheme; stamps reuse the ledger

The owner chose option A, "the 10th drink is free", as the program. One stamp is stored as one unit of the existing ledger balance and the free drink is an ordinary reward costing 9, so accounts, guest cards, QR redemption, refund reversal, idempotency, append-only history and concurrency guarantees are unchanged and no second store exists. Earning counts drink quantity (capped at 10 per order or visit), not dollars; `points_per_dollar` is retired but its column kept. Migration 011 clears preview balances through the ledger and refuses to run if the program is commercially authorized and balances exist. Open owner decisions: eligible drinks, free-drink value cap, per-order cap, promotion stacking, expiry.
