# Agent instructions

Read README.md, docs/HANDOFF.md, docs/IMPLEMENTATION_STATUS.md and docs/IMPLEMENTATION_PLAN.md first. Work in the existing checkout. Keep the application a strict TypeScript modular monolith and keep business state in PostgreSQL. Validate input and enforce staff permissions on the server. Never commit credentials, real customer data, or local database files. Preserve French and English parity on the public site and label demo data. Exception, an owner decision: the administration and staff console (`/admin/*`, `/staff/*`) is English only; French URLs for it redirect to `/en/...`, and new admin or staff screens must be written in English with no French strings. Run npm run check, npm test and npm run build before handing off. Update affected documentation and record decisions, test outcomes, and concrete next steps. A feature is complete only after persistence, permissions, error states, localization and representative verification are in place.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
