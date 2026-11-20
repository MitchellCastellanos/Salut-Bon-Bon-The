/**
 * Demo mode (SALUT_DEMO_MODE=1, database required): the whole Salut Plus journey can be shown without connecting Stripe or Resend.
 * Payments use the simulated checkout page (only while Stripe is not configured), email is recorded in the outbox but never sent,
 * and customer accounts need no email verification. Every provider adapter stays in place, so connecting real credentials later
 * switches the behaviour without code changes. It must be off for a real launch.
 */
export function demoMode() {
  return process.env.SALUT_DEMO_MODE === "1" && Boolean(process.env.DATABASE_URL);
}
