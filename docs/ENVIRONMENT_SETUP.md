# Environment setup

Use Node.js 24. Run `npm ci` and `npm run dev` in the checkout. The credential-free demo initializes migration 001 on its first order query and persists in `.salut-data`. Stop the process before moving or backing up this directory. Run only one process against the same PGlite path. Set `SALUT_DATA_DIR` to isolate a local demo. The demo staff password is `salut-demo`. Keep demo instances private and use synthetic orders.

## Individual staff sign-in

1. Create an isolated PostgreSQL or Neon test database. Apply `db/001-orders.sql` and then `db/002-staff-auth.sql` via a secure SQL client. Apply 002 once.
2. Configure `DATABASE_URL` and `BETTER_AUTH_SECRET` with a random secret of at least 32 characters. Set `BETTER_AUTH_URL` to the browser-facing origin, using HTTPS except on loopback. An incomplete configuration disables staff sign-in when a database is configured.
3. Provision each user on a trusted operator machine. Supply the password on stdin using an approved secret source. For example, in Bash with `DATABASE_URL` already exported:

   ```bash
   read -rsp 'Temporary staff password: ' staff_setup_password
   printf '%s' "$staff_setup_password" | npm run staff:create -- ADMIN owner@example.com 'Store owner'
   unset staff_setup_password
   ```

4. Sign in at `/fr/staff` or `/en/staff` using the provisioned email and password. Use `STAFF` for staff accounts and `ADMIN` for owners or administrators. Both roles can handle orders. The operator must handle credential resets and role changes through a trusted database workflow until account management is implemented.

Legacy `STAFF_PASSWORD` and `SESSION_SECRET` no longer enable staff access. Remove them when moving to the new configuration. Set `SITE_URL` to an authorized absolute origin for canonical URLs and sitemap. Keep real values out of Git.

Set optional `INSTAGRAM_URL` to the verified official HTTPS Instagram profile. The storefront hides the external link until it is supplied and displays a locally curated gallery.
