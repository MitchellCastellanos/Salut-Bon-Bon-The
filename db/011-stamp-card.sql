-- Free-drink stamp card: 9 eligible drinks purchased, the 10th is free (replaces the 10-points-per-$1 / $5 reward preview).
-- The ledger, QR tokens, guest cards, refund reversal and the two PL/pgSQL functions are reused unchanged:
-- one stamp is stored as one unit of `loyalty_accounts.balance`, and the free drink is an ordinary reward that costs 9 units.
-- `loyalty_program.points_per_dollar` is no longer read; the column is kept so earlier migrations stay valid.

-- 1. Preview balances of the abandoned points scheme must not be reinterpreted as stamps. Each is cleared through the
-- append-only ledger (auditable). If the owner had already authorized the program commercially, real balances may exist:
-- refuse to guess and let a person decide how to convert them.
DO $$
DECLARE acct record;
BEGIN
  IF EXISTS (SELECT 1 FROM loyalty_program WHERE id = 1 AND commercial_authorized) AND EXISTS (SELECT 1 FROM loyalty_accounts WHERE balance > 0) THEN
    RAISE EXCEPTION 'Program is commercially authorized and accounts hold points: convert balances manually before migrating to stamps';
  END IF;
  FOR acct IN SELECT id, balance FROM loyalty_accounts WHERE balance > 0 LOOP
    PERFORM loyalty_post(acct.id, 'adjust', -acct.balance, 'stamps-migration:' || acct.id, NULL, NULL, NULL,
      'Switch from points to the free-drink stamp card', 'system:migration-011');
  END LOOP;
END $$;

-- 2. The points reward is withdrawn from the public listing and from redemption.
UPDATE loyalty_rewards SET available = false, preview_visible = false WHERE id = 'rabais-5';

-- 3. The free drink: costs 9 stamps (the 10th drink is the reward). Offered, but nothing is earned or redeemed until
-- an ADMIN activates the program (and, in production, records the owner's authorization).
INSERT INTO loyalty_rewards (id, name_fr, name_en, description_fr, description_en, points_cost, discount_cents, available, preview_visible)
VALUES ('free-drink', 'Boisson gratuite', 'Free drink',
  'La 10e boisson est offerte : choisissez-la au comptoir après 9 boissons admissibles achetées.',
  'Your 10th drink is on us: pick it at the counter after 9 eligible drinks purchased.', 9, NULL, true, true)
ON CONFLICT (id) DO NOTHING;
