# Isolated order + Rewards walkthrough (review build)

Routes: `/fr/demo-commande` and `/en/demo-order`.

This is an **interactive, browser-local presentation**, not the live commerce checkout. It deliberately does not call order, payment, STAFF or loyalty server actions. A sample order can be customized, priced, placed, tracked and advanced through five simulated fulfillment states using the same browser's localStorage. Sample reward points are calculated at 10 per whole pre-tax dollar, with the 1,000-point = $5 equivalence. They are **never credited**.

The owner-provided logo was traced to a transparent vector at `public/brand/logo.svg`; the existing `officialLogo()` helper now resolves it. Verify visual fidelity against the supplied original before merging. Email needs a separate raster PNG.

## Important remaining work before claiming a full end-to-end demo

- Build an isolated **server-backed** demo database/branch with session-scoped demo orders so two devices can see the same order and real STAFF state updates. The current prototype is single-browser only.
- Connect a demo cart to the full 62-product catalog and 124 demo variants (currently five illustrative choices), including modifier eligibility, price-change confirmation and sample tax/slot rules.
- Add a polished home/catalog CTA, mobile styling, and bilingual review of all text.
- Add tests for pricing, persistence, fake checkout, state transitions, privacy and accessibility; run lint, typecheck, build and browser tests. None have been run for this branch.
- Provide explicit sandbox controls for resetting sample orders, a demo-only staff access model, and clearly separate live vs sample data.
- Ensure no actual emails, Stripe calls, real loyalty transactions, production order writes, or operational flags can be triggered by this demo.
- Do not activate commercial checkout or loyalty. Never copy simulated fiscal settings into real business configuration.
