# Launch readiness

- [ ] Provision dedicated Neon project and isolate production, development and migration testing.
- [ ] Verify migrations and double import in Neon development. Apply reviewed changes to production.
- [ ] Provision individual ADMIN accounts and verify server-side role enforcement.
- [ ] Enter approved pricing, tax, availability, hours, pickup lead time and capacity.
- [ ] Implement approved modifier eligibility and production checkout rate limits.
- [ ] Verify Stripe test checkout, signature verification and replay-safe reconciliation before payment activation.
- [ ] Verify Resend sender and bilingual templates with synthetic recipients. Add optional Twilio opt-in and safe test setup if needed.
- [ ] Configure Vercel environment, preview and production domain and DNS.
- [ ] Complete legal and privacy review, including analytics consent.
- [ ] Run production smoke tests with approved fixtures and obtain owner sign-off.

Keep checkout disabled until these dependencies are addressed. The local smoke suite covers pay at pickup and simulated demo flows. Provider credentials and hosted deployments remain outside this milestone.
