# Salut Bon Bon Thé

Gaban Solutions is building **Salut Plus**, the recommended package of a bilingual (FR/EN) pickup-ordering and loyalty platform for a Montréal bubble tea shop. Next.js App Router, strict TypeScript, Tailwind CSS, Zod, PostgreSQL (Neon in deployment, PGlite for the local demo), Better Auth, Stripe (test mode) and Resend.

**Status in one line:** ordering, staff operations, customer accounts, tax, scheduling and a 9+1 stamp engine are built and tested; the logo QR, stable identification token, Apple Wallet, favorites/reorder, refunds and several owner admin screens are not. Loyalty, live payment and live email are inactive by design. Details: [Project status](docs/PROJECT_STATUS.md).

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open `/fr` or `/en`. Without `DATABASE_URL` the app runs a private credential-free demo (staff area at `/en/staff`, password `salut-demo`, data in the ignored `.salut-data` folder); use synthetic names only. For database-backed sign-in and the full journey see [Technical reference](docs/TECHNICAL.md#staff-admin-and-team-provisioning).

```sh
npm run check   # route types, TypeScript, ESLint
npm test        # unit and integration tests (more with TEST_DATABASE_URL)
npm run build
```

The administration and staff console (`/admin/*`, `/staff/*`) is English only; the public site is fully bilingual. Never commit credentials, certificates, real customer data or local database files.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/COMMERCIAL.md](docs/COMMERCIAL.md) | Packages, prices, Plus positioning, Premium scope |
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Requirements, end-to-end acceptance, Rewards 9+1, QR and Wallet design, admin requirements |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | What is really built, gaps, owner decisions, roadmap |
| [docs/TECHNICAL.md](docs/TECHNICAL.md) | Architecture, migrations, configuration, integrations, security, deployment, tests |
| [docs/TAX.md](docs/TAX.md) | GST/QST rules and Québec billing findings |
| [docs/DECISIONS.md](docs/DECISIONS.md), [docs/CHANGELOG.md](docs/CHANGELOG.md) | Decision log and change history |
| [docs/IMAGE_ASSET_MANIFEST.md](docs/IMAGE_ASSET_MANIFEST.md) | Image slots and prompts (`docs/image-prompts/`) |
| [docs/archive/](docs/archive/) | Superseded material (points-era loyalty) |

Agents: read [AGENTS.md](AGENTS.md) first.
