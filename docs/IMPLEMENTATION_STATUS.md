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

Stripe and Resend test adapters are present. Payment and notification orchestration, Twilio, real Neon and Vercel validation, and owner sign-off remain pending. Media prompt files are ready for use. Approved photography and other brand assets remain pending.
