# Salut Plus — administration requirements and future UX audit
Decision date: 2026-11-20. Status: ACCEPTANCE SCOPE, not a claim of implementation.

## Principle
Salut Plus is not end-to-end until the owner can operate its promised functions without developer intervention. Every configurable business rule needs a secure ADMIN control, validation, persistence, feedback, audit trail, and documented default. Separate ADMIN (configuration, sensitive actions) from STAFF (daily order fulfillment and authorized loyalty operations). No admin screen may silently bypass production activation or owner authorization.

## Admin capability checklist (audit against code; build missing capabilities)
1. **Overview:** actionable dashboard for new/paid/preparing/ready/completed/cancelled orders, issues requiring attention, quick links, clear empty/error states and last-updated indication.
2. **Orders:** searchable/filterable order queue and history; details, modifiers, taxes, payment status, customer/guest context, pickup slot, state transitions, refund/cancellation workflow with safeguards, duplicate prevention, event history and staff attribution.
3. **Catalog:** CRUD for products, collections/categories, images, localized FR/EN descriptions, availability, visibility, featured items, prices, sizes, topping rules (included tapioca and paid extras), modifier compatibility, stock-outs, and preview-before-publish; server pricing is authoritative.
4. **Store/pickup operations:** business contact details, location, opening hours, exceptional closures, pickup slot rules, lead times, capacity, order pause/resume, fulfillment settings and clear operational notices.
5. **Payments/taxes:** Stripe TEST/LIVE readiness indication (no raw secrets), payment/reconciliation/refund status, tax configuration and receipts, safe activation controls and audit; never process real charges in the demo.
6. **Customer accounts:** search customer by permitted identifiers, account/order/loyalty context, account status, minimal personal data exposure, privacy controls and support workflows; staff must not gain customer impersonation privileges.
7. **Salut Rewards 9+1:** owner authorization and activation; eligibility categories, min purchase, stamp cap, free drink max value, promotion stacking, expiration/refund policy, guest/member linking, lookup, balance/history, adjustments with mandatory reason, suspension, and staff scan/award/redeem; idempotency and audit.
8. **Apple Wallet passes:** pass issuance and signing readiness, template/logo/brand assets, pass status and last update, reissue/revoke/rotate identification token, stamp updates, failed updates and safe support diagnostics; never expose signing credentials. Stable revocable identification barcode, not five-minute redemption QR.
9. **Notifications:** transactional templates and FR/EN preview, email/SMS provider status, opt-in/consent where applicable, delivery logs, retries/failures, test/live gates and safe resend.
10. **Analytics:** basic Plus reporting for orders, sales, products, loyalty participation and redemption with privacy/consent, filters, date ranges and definitions; advanced marketing analytics are Premium scope.
11. **Staff and access:** staff account/role lifecycle, least privilege, admin-only settings, secure sign-in, session handling, critical-action confirmations, audit log, operational diagnostics.
12. **Content and site settings:** brand/logo, bilingual storefront content, homepage campaign visibility, SEO essentials, public rewards copy, legal/contact links and publication status.

## Functional acceptance
For each row above, Claude must classify implemented/partial/missing/blocked with exact paths, tests, ownership and minimal fixes. A Plus demo must show owner controls affecting the storefront, checkout, order handling, loyalty card and Wallet in the test environment. Never label simulated or absent capabilities as complete. Preserve live-production gates.

## Dedicated later audit: Admin UX/UI (NOT part of initial build scope)
Schedule a separate comprehensive admin interface audit after core capability coverage. Evaluate information architecture/navigation, grouping, dashboard prioritization, workflows/click counts, discoverability, search/filter, bulk actions, forms and validation, feedback and errors, bilingual wording, mobile/tablet behavior, accessibility/keyboard, permissions visibility, performance, consistency, empty/loading states, destructive-action safeguards and onboarding/help. Include task-based usability scenarios for owner and staff, annotated evidence, severity/impact ranking, low-effort wins, wireframe recommendations and phased implementation. Do not undertake a large redesign in the initial feature audit without explicit approval.

## Documentation sync
Cross-link this checklist from COMMERCIAL_PACKAGES.md and PLUS_END_TO_END_ACCEPTANCE.md, and reconcile IMPLEMENTATION_STATUS, IMPLEMENTATION_PLAN, LAUNCH_READINESS, HANDOFF, DEMO_GUIDE, ARCHITECTURE, ENVIRONMENT_SETUP, REWARDS, TESTING and other admin docs during the Claude audit. Historical statements must be dated and distinguished from current truth.
