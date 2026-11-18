# Salut Bon Bon Thé

Gaban Solutions is building Salut Plus, a bilingual pickup-ordering platform for a Montréal bubble tea business. The first slice covers a demo menu, guest checkout, private tracking and staff order handling.

## Run locally

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the French storefront at `/fr`, the English storefront at `/en`, or the staff area at `/en/staff`. In the credential-free local demo the staff password is `salut-demo`. Use synthetic names and notes. Orders persist in the ignored `.salut-data` directory. Keep the shared-password demo private. For database-backed individual staff sign-in, use the [staff setup instructions](docs/ENVIRONMENT_SETUP.md#individual-staff-sign-in).

```sh
npm run check
npm test
npm run build
```

Next.js App Router, strict TypeScript, Tailwind CSS, Zod and PostgreSQL through PGlite or pg. See [status](docs/IMPLEMENTATION_STATUS.md), [handoff](docs/HANDOFF.md), [plan](docs/IMPLEMENTATION_PLAN.md), [setup](docs/ENVIRONMENT_SETUP.md), [architecture](docs/ARCHITECTURE.md), and [demo guide](docs/DEMO_GUIDE.md).

## Salut Rewards (Récompenses Salut)

A public preview of the loyalty program lives at `/fr/recompenses` and `/en/rewards` (no login). Terms loaded by migration 009: 10 points per $1 CAD on the pre-tax eligible subtotal (5 %), 1,000 points = $5 off, redeemed at the counter. The program ships **inactive**: nothing is earned or redeemed until an ADMIN activates it (production also needs the recorded owner authorization). Guest cards work without an account. Details: [Rewards](docs/REWARDS.md); client-facing comparison of both loyalty options (French): [Loyalty commercial proposal](docs/LOYALTY_COMMERCIAL_PROPOSAL.md). Extra checks: `npm run test:rewards` and `npm run test:rewards-public` (see [Testing](docs/TESTING.md)).
