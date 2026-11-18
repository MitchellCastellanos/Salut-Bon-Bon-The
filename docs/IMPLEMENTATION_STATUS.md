# Implementation status

| Area | Status | Delivered and remaining |
| --- | --- | --- |
| Foundation | Partial | Next.js, strict TypeScript, pinned dependencies, localized route structure, PostgreSQL schema and verification commands. Better Auth staff sessions and SQL migration 002 added. Prisma and Neon rehearsal pending |
| Storefront and menu | Partial | Bilingual responsive home, featured carousel, category filters and customization. Official menu, assets, store details, admin editing and product availability pending |
| Orders | Verified demo slice | Guest checkout, persistent cart, server pricing, submission idempotency, pickup and simulated payment, private tracking. Capacity, opening hours, pause, tax and account checkout pending |
| Store operations | Verified demo slice | Individual STAFF/ADMIN sign-in in PostgreSQL mode, shared local demo, automatic polling, order transitions and pickup settlement. Admin-only management screens, order history pagination, sound and actor audit pending |
| Accounts and loyalty | Planned | Customer accounts, QR scanning, rewards ledger, favorites and reorder |
| Payments and notifications | Partial | Local simulated payment. Stripe, Resend, Twilio, refunds, delivery log and outbox pending |
| Analytics | Planned | Consent, event collection and reports |
| Quality and deployment | Partial | Unit and browser smoke coverage, draft legal pages, sitemap and language metadata. Neon and Vercel remain unverified |

This demo uses sample products and fixed rolling slots. Keep the demo private. See [testing](TESTING.md) and [handoff](HANDOFF.md).
