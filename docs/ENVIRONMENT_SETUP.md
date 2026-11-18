# Environment setup

Use Node.js 24. Run `npm ci` and `npm run dev` in the checkout. The database initializes on the first order query. Local storage persists in `.salut-data`; stop the process before moving or backing up this directory. Run only one process against the same PGlite data path. To isolate a demo, set `SALUT_DATA_DIR` to a separate writable directory.

The credential-free staff password is `salut-demo`. To override it, set both `STAFF_PASSWORD` (at least 12 characters) and `SESSION_SECRET` (at least 32 characters). For Neon, apply `db/001-orders.sql` via a secure SQL client or the Neon SQL editor before setting `DATABASE_URL`; set both staff variables too. Set `SITE_URL` to an authorized absolute origin for canonical URLs and sitemap. Keep real values out of Git.
