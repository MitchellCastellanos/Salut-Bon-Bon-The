# Implementation status

| Area | Status | Delivered and remaining |
| --- | --- | --- |
| Foundation | Partial | Next.js, strict TypeScript, pinned dependencies, localized route structure, PostgreSQL schema and verification commands. Better Auth staff sessions and SQL migration 002 added. Prisma and Neon rehearsal pending |
| Storefront and menu | Partial | Approved mockup layout implemented with a full-width campaign carousel, seven category tiles, five demo favorites, pickup and rewards banners, Instagram gallery and rich footer. Official menu, photos, logo, social profile, store details and admin editing pending |
| Orders | Verified demo slice | Guest checkout, persistent cart, server pricing, submission idempotency, pickup and simulated payment, private tracking. Capacity, opening hours, pause, tax and account checkout pending |
| Store operations | Verified demo slice | Individual STAFF/ADMIN sign-in in PostgreSQL mode, shared local demo, automatic polling, order transitions and pickup settlement. Admin-only management screens, order history pagination, sound and actor audit pending |
| Customer accounts and Récompenses Salut / Salut Rewards | Preview | Bilingual coming-soon banner. Customer accounts, QR scanning, rewards ledger, favorites and reorder are planned |
| Payments and notifications | Partial | Local simulated payment. Stripe, Resend, Twilio, refunds, delivery log and outbox pending |
| Analytics | Planned | Consent, event collection and reports |
| Quality and deployment | Partial | Unit and browser smoke coverage, draft legal pages, sitemap and language metadata. Neon and Vercel remain unverified |

This demo uses sample products and fixed rolling slots. Keep the demo private. See [testing](TESTING.md) and [handoff](HANDOFF.md).

## Commercial catalog checkpoint

The official dataset, idempotent import, searchable catalog preview and collection landing pages are implemented. ADMIN can edit catalog entries, modifiers and eligibility, collection memberships, image paths, featured positions, prices, availability, campaigns and pickup policy. Checkout resolves approved, available prices on the server, applies configured tax, serializes capacity checks and stays disabled until explicitly enabled. Opt-in first-party analytics includes an ADMIN date filter and campaign breakdown.

Stripe and Resend test adapters are present. Payment and notification orchestration, Twilio, real Neon and Vercel validation, and owner sign-off remain pending. Media prompt files are ready for use. Photography was uploaded and integrated on 2026-11-18 (26 images plus one unused extra); the official logo and the three rewards/account images remain pending.

## 2026-11-18 update

Added: Neon project and branches, migration runner and ledger, migration 005, Stripe Checkout and webhook reconciliation (test mode), Resend outbox and bilingual templates, closures, staff order search, payment-aware order states, production fail-closed storage guard, CI, asset register, tax and security documentation. Verified state and open items are in [LAUNCH_READINESS.md](LAUNCH_READINESS.md). Migration 002 had its own `BEGIN`/`COMMIT` removed so the runner owns the transaction; it was never applied to a persistent database before this change.

## 2026-11-18 update 2

Added: customer accounts (separate Better Auth instance), Récompenses Salut with atomic idempotent engine and QR redemption, ADMIN rewards console, staff QR screen, visual hours editor and exceptional schedules, slot length/advance window/cutoff, price sheet, cart quantity controls, brand component and wiring, BATCH-06 prompts, migrations 006–007, real-PostgreSQL concurrency tests, and a rewards/accounts browser suite. Gift cards are out of scope and absent. Verified state and gaps: [Launch readiness](LAUNCH_READINESS.md).
