# Salut Bon Bon Thé

Gaban Solutions is building Salut Plus, a bilingual pickup-ordering platform for a Montréal bubble tea business. The first slice covers a demo menu, guest checkout, private tracking and staff order handling.

## Run locally

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the French storefront at `/fr`, the English storefront at `/en`, or the staff area at `/en/staff`. In the credential-free local demo the staff password is `salut-demo`. Use synthetic names and notes. Orders persist in the ignored `.salut-data` directory. This shared-password demo must stay on a private instance.

```sh
npm run check
npm test
npm run build
```

Next.js App Router, strict TypeScript, Tailwind CSS, Zod and PostgreSQL through PGlite or pg. See [status](docs/IMPLEMENTATION_STATUS.md), [handoff](docs/HANDOFF.md), [plan](docs/IMPLEMENTATION_PLAN.md), [setup](docs/ENVIRONMENT_SETUP.md), [architecture](docs/ARCHITECTURE.md), and [demo guide](docs/DEMO_GUIDE.md).
