# Testing

- `npm run check` generates route types, checks strict TypeScript and runs ESLint.
- `npm test` verifies pricing, modifier validation, concurrent order retries, private lookup, state transitions, payment guards and stale pickups against ephemeral PGlite.
- `npm run build` builds the optimized app.
- `npm run test:browser` drives the built app through mobile locale switching, carousel, customization, cart reload, pickup checkout, private tracking, failed and successful staff login and fulfillment. Start the app at port 3100 with an isolated writable `SALUT_DATA_DIR` and local demo credentials. Set `CHROMIUM_PATH` for a different browser binary or `SMOKE_BASE_URL` to use a different origin. Opt in to writing the generated synthetic receipt URL by setting `SMOKE_RECEIPT_FILE`. To verify a restart, run the browser command with that synthetic URL as its argument after restarting with the same data directory.

Neon connectivity, multitenant authorization, payment webhooks, notifications, loyalty and analytics lack test coverage. Manual QA remains for a full keyboard pass, screen-reader behavior and verified business content.

## Latest results

In the cloud checkout, `npm run check` passed without warnings, `npm test` passed all four tests, and `npm run build` succeeded. The Chromium smoke passed against `next start`; a separate browser check confirmed the completed synthetic order remained available after restarting on the same data directory. The final production dependency audit reported zero known vulnerabilities.
