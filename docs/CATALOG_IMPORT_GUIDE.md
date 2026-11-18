# Official catalog import

1. Apply migrations through 003 in order on the intended target. Read [Neon setup](NEON_SETUP.md) before targeting hosted infrastructure.
2. Run `node scripts/import-catalog.mjs` with `DATABASE_URL` injected securely.
3. Run the command again. The import uses stable keys and leaves existing rows intact so a rerun preserves admin edits.
4. On a fresh branch expect 62 products, 52 printed codes, 124 translations, 18 modifiers and six poster memberships.
5. Use `node scripts/import-catalog.mjs --verify-local` for a credential-free repeat-import check on ephemeral PGlite.

Availability defaults to false. Use the ADMIN pricing page for regular, large and promotional variants. Leave checkout disabled until the launch checks are complete. The server reads the exact JSON boolean `true` for `pickup_checkout_enabled` in `catalog_store_settings` before it exposes orderable prices. Keep that key absent in production during preview.

The ADMIN console accepts a JSON array to update up to 124 distinct product/size pairs atomically. Use keys id, size, price, promo, approved and available. Prices are whole cents. promo may be null. Confirm approved product-to-modifier assignments and surcharge amounts separately before enabling checkout.
