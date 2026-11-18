-- Salut Rewards 5 %: preview configuration, operation flags, monetary reward value, guest cards,
-- refund reversal and a public-safe reward listing. The program is seeded INACTIVE: nothing is earned or redeemed
-- until an ADMIN activates it (and, in production, records the owner's commercial authorization).

-- 1. Lifecycle flags. `active` stays the master operations switch.
ALTER TABLE loyalty_program
  ADD COLUMN IF NOT EXISTS preview_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accrual_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redemption_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS commercial_authorized boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commercial_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_authorized_by text;

-- Initial preview configuration: 10 points per $1 CAD (= 5 % with the $5 / 1,000-point reward below).
UPDATE loyalty_program SET points_per_dollar = 10 WHERE id = 1 AND points_per_dollar IS NULL AND NOT active;

-- 2. Monetary reward value and public visibility.
ALTER TABLE loyalty_rewards
  ADD COLUMN IF NOT EXISTS discount_cents integer CHECK (discount_cents IS NULL OR discount_cents BETWEEN 1 AND 100000),
  ADD COLUMN IF NOT EXISTS preview_visible boolean NOT NULL DEFAULT true;

-- Not offered: it is shown as "coming soon" until an ADMIN offers it. Redeemed at the counter only.
INSERT INTO loyalty_rewards (id, name_fr, name_en, description_fr, description_en, points_cost, discount_cents, available)
VALUES ('rabais-5', '5 $ de rabais', '$5 off', 'Rabais de 5 $ appliqué en caisse sur votre achat admissible.',
  '$5 discount applied at the counter on your eligible purchase.', 1000, 500, false)
ON CONFLICT (id) DO NOTHING;

-- 3. Guest cards: an account without a login, identified only by a random secret stored as a SHA-256 hash.
ALTER TABLE loyalty_accounts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE loyalty_accounts
  ADD COLUMN IF NOT EXISTS guest_secret_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES loyalty_accounts (id);
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'loyalty_accounts'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE loyalty_accounts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE loyalty_accounts ADD CONSTRAINT loyalty_accounts_status_check CHECK (status IN ('active', 'suspended', 'merged'));
ALTER TABLE loyalty_accounts ADD CONSTRAINT loyalty_accounts_identity_check
  CHECK (user_id IS NOT NULL OR guest_secret_hash IS NOT NULL OR status = 'merged');

ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_account_id uuid REFERENCES loyalty_accounts (id);
CREATE INDEX IF NOT EXISTS orders_loyalty_account_idx ON orders (loyalty_account_id) WHERE loyalty_account_id IS NOT NULL;

-- 4. Ledger: a `reverse` kind (refunds) and the eligible base recorded on each order earn.
ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS eligible_cents integer CHECK (eligible_cents IS NULL OR eligible_cents >= 0);
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'loyalty_transactions'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%kind%' LOOP
    EXECUTE format('ALTER TABLE loyalty_transactions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE loyalty_transactions
  ADD CONSTRAINT loyalty_transactions_kind_check CHECK (kind IN ('earn', 'redeem', 'adjust', 'reverse')),
  ADD CONSTRAINT loyalty_transactions_sign_check CHECK (
    (kind = 'earn' AND points > 0) OR (kind IN ('redeem', 'reverse') AND points < 0) OR kind = 'adjust'),
  ADD CONSTRAINT loyalty_transactions_adjust_reason_check CHECK (kind <> 'adjust' OR (reason IS NOT NULL AND length(reason) >= 3));

-- 5. Refund events (append-only). One row per recorded refund of the pre-tax purchase amount.
CREATE TABLE IF NOT EXISTS loyalty_refund_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number bigint NOT NULL REFERENCES orders (number),
  refund_cents integer NOT NULL CHECK (refund_cents > 0),
  points_reversed integer NOT NULL CHECK (points_reversed >= 0),
  shortfall integer NOT NULL CHECK (shortfall >= 0),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 300),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_refund_events_order_idx ON loyalty_refund_events (order_number);
DROP TRIGGER IF EXISTS loyalty_refund_events_append_only ON loyalty_refund_events;
CREATE TRIGGER loyalty_refund_events_append_only BEFORE UPDATE OR DELETE ON loyalty_refund_events
  FOR EACH ROW EXECUTE FUNCTION reject_history_change();

-- 6. Posting function with the eligible base. The old nine-argument version is replaced, not overloaded.
DROP FUNCTION IF EXISTS loyalty_post(uuid, text, integer, text, bigint, text, text, text, text);
CREATE OR REPLACE FUNCTION loyalty_post(
  p_account uuid, p_kind text, p_points integer, p_key text, p_order bigint,
  p_reward text, p_reward_name text, p_reason text, p_actor text, p_eligible integer DEFAULT NULL
) RETURNS TABLE (o_duplicate boolean, o_balance integer, o_txn bigint)
LANGUAGE plpgsql AS $$
DECLARE acct loyalty_accounts%ROWTYPE; prior loyalty_transactions%ROWTYPE; next_balance integer; new_id bigint;
BEGIN
  SELECT * INTO acct FROM loyalty_accounts WHERE id = p_account FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND'; END IF;
  SELECT * INTO prior FROM loyalty_transactions WHERE idempotency_key = p_key;
  IF FOUND THEN
    IF prior.account_id <> p_account OR prior.kind <> p_kind OR prior.points <> p_points THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN QUERY SELECT true, prior.balance_after, prior.id;
    RETURN;
  END IF;
  IF acct.status <> 'active' AND p_kind IN ('earn', 'redeem') THEN RAISE EXCEPTION 'ACCOUNT_SUSPENDED'; END IF;
  next_balance := acct.balance + p_points;
  IF next_balance < 0 THEN RAISE EXCEPTION 'INSUFFICIENT_POINTS'; END IF;
  INSERT INTO loyalty_transactions (account_id, kind, points, balance_after, idempotency_key, order_number, reward_id, reward_name, reason, actor, eligible_cents)
  VALUES (p_account, p_kind, p_points, next_balance, p_key, p_order, p_reward, p_reward_name, p_reason, p_actor, p_eligible)
  RETURNING id INTO new_id;
  UPDATE loyalty_accounts SET balance = next_balance, lifetime_earned = lifetime_earned + GREATEST(p_points, 0) WHERE id = p_account;
  RETURN QUERY SELECT false, next_balance, new_id;
END $$;

-- 7. Redemption honours the redemption switch.
CREATE OR REPLACE FUNCTION loyalty_redeem(p_token_hash text, p_reward text, p_key text, p_actor text)
RETURNS TABLE (o_duplicate boolean, o_balance integer, o_txn bigint, o_reward text)
LANGUAGE plpgsql AS $$
DECLARE tok loyalty_qr_tokens%ROWTYPE; rw loyalty_rewards%ROWTYPE; prior loyalty_transactions%ROWTYPE; res record; prog loyalty_program%ROWTYPE;
BEGIN
  SELECT * INTO tok FROM loyalty_qr_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QR_INVALID'; END IF;
  SELECT * INTO prior FROM loyalty_transactions WHERE idempotency_key = p_key AND account_id = tok.account_id AND kind = 'redeem';
  IF FOUND THEN RETURN QUERY SELECT true, prior.balance_after, prior.id, prior.reward_name; RETURN; END IF;
  IF tok.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'QR_USED'; END IF;
  IF tok.expires_at < now() THEN RAISE EXCEPTION 'QR_EXPIRED'; END IF;
  SELECT * INTO prog FROM loyalty_program WHERE id = 1;
  IF NOT prog.active THEN RAISE EXCEPTION 'PROGRAM_INACTIVE'; END IF;
  IF NOT prog.redemption_enabled THEN RAISE EXCEPTION 'REDEMPTION_DISABLED'; END IF;
  SELECT * INTO rw FROM loyalty_rewards WHERE id = p_reward AND available;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_UNAVAILABLE'; END IF;
  SELECT * INTO res FROM loyalty_post(tok.account_id, 'redeem', -rw.points_cost, p_key, NULL, rw.id, rw.name_en, NULL, p_actor);
  UPDATE loyalty_qr_tokens SET redeemed_at = now() WHERE id = tok.id;
  RETURN QUERY SELECT res.o_duplicate, res.o_balance, res.o_txn, rw.name_en;
END $$;

-- 8. Refund reversal. Points kept = floor(earned x remaining eligible / eligible), so a full refund removes every point
-- and the result never depends on later changes to the rate. The balance is never driven negative: any amount that
-- cannot be taken (points already spent) is recorded as `shortfall` for the owner to review.
CREATE OR REPLACE FUNCTION loyalty_reverse_refund(p_order bigint, p_refund_cents integer, p_key text, p_reason text, p_actor text)
RETURNS TABLE (o_duplicate boolean, o_reversed integer, o_shortfall integer, o_balance integer)
LANGUAGE plpgsql AS $$
DECLARE earn loyalty_transactions%ROWTYPE; acct loyalty_accounts%ROWTYPE; prior loyalty_refund_events%ROWTYPE;
  cumulative integer; kept integer; target integer; already integer; delta integer; take integer; res record; bal integer;
BEGIN
  IF p_refund_cents IS NULL OR p_refund_cents < 1 THEN RAISE EXCEPTION 'FAILED'; END IF;
  SELECT * INTO earn FROM loyalty_transactions WHERE kind = 'earn' AND order_number = p_order;
  IF NOT FOUND OR earn.eligible_cents IS NULL OR earn.eligible_cents < 1 THEN RAISE EXCEPTION 'NO_EARN_FOR_ORDER'; END IF;
  SELECT * INTO acct FROM loyalty_accounts WHERE id = earn.account_id FOR UPDATE;
  SELECT * INTO prior FROM loyalty_refund_events WHERE idempotency_key = p_key;
  IF FOUND THEN
    IF prior.order_number <> p_order OR prior.refund_cents <> p_refund_cents THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'; END IF;
    RETURN QUERY SELECT true, prior.points_reversed, prior.shortfall, acct.balance;
    RETURN;
  END IF;
  SELECT COALESCE(sum(refund_cents), 0) + p_refund_cents, COALESCE(sum(points_reversed + shortfall), 0)
    INTO cumulative, already FROM loyalty_refund_events WHERE order_number = p_order;
  IF cumulative > earn.eligible_cents THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PURCHASE'; END IF;
  kept := floor(earn.points::numeric * (earn.eligible_cents - cumulative) / earn.eligible_cents);
  target := earn.points - kept;
  delta := GREATEST(target - already, 0);
  take := LEAST(delta, acct.balance);
  bal := acct.balance;
  IF take > 0 THEN
    SELECT * INTO res FROM loyalty_post(acct.id, 'reverse', -take, 'reverse:' || p_key, p_order, NULL, NULL,
      left('Refund: ' || p_reason, 300), p_actor);
    bal := res.o_balance;
  END IF;
  INSERT INTO loyalty_refund_events (order_number, refund_cents, points_reversed, shortfall, idempotency_key, reason, actor)
  VALUES (p_order, p_refund_cents, take, delta - take, p_key, p_reason, p_actor);
  RETURN QUERY SELECT false, take, delta - take, bal;
END $$;

-- 9. Atomic, idempotent link of a guest card to a customer account. Existing points are moved through the ledger,
-- never copied, so nothing can be counted twice. The guest secret stops working once the link succeeds.
CREATE OR REPLACE FUNCTION loyalty_link_guest(p_secret_hash text, p_user text)
RETURNS TABLE (o_account uuid, o_moved integer)
LANGUAGE plpgsql AS $$
DECLARE guest loyalty_accounts%ROWTYPE; member loyalty_accounts%ROWTYPE; moved integer := 0;
BEGIN
  SELECT * INTO guest FROM loyalty_accounts WHERE guest_secret_hash = p_secret_hash AND user_id IS NULL FOR UPDATE;
  IF NOT FOUND OR guest.status <> 'active' THEN RAISE EXCEPTION 'GUEST_NOT_FOUND'; END IF;
  SELECT * INTO member FROM loyalty_accounts WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    UPDATE loyalty_accounts SET user_id = p_user, guest_secret_hash = NULL, linked_at = now() WHERE id = guest.id;
    RETURN QUERY SELECT guest.id, 0;
    RETURN;
  END IF;
  IF member.status <> 'active' THEN RAISE EXCEPTION 'ACCOUNT_SUSPENDED'; END IF;
  IF guest.balance > 0 THEN
    PERFORM loyalty_post(guest.id, 'adjust', -guest.balance, 'link-out:' || guest.id, NULL, NULL, NULL, 'Card linked to member account', 'system:link');
    PERFORM loyalty_post(member.id, 'adjust', guest.balance, 'link-in:' || guest.id, NULL, NULL, NULL, 'Guest card linked to this account', 'system:link');
    moved := guest.balance;
  END IF;
  UPDATE orders SET loyalty_account_id = member.id WHERE loyalty_account_id = guest.id;
  UPDATE loyalty_accounts SET status = 'merged', guest_secret_hash = NULL, merged_into = member.id, linked_at = now() WHERE id = guest.id;
  RETURN QUERY SELECT member.id, moved;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salut_app') THEN
    GRANT SELECT, INSERT ON loyalty_refund_events TO salut_app;
    REVOKE UPDATE, DELETE ON loyalty_refund_events FROM salut_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO salut_app;
    GRANT EXECUTE ON FUNCTION loyalty_post(uuid, text, integer, text, bigint, text, text, text, text, integer) TO salut_app;
    GRANT EXECUTE ON FUNCTION loyalty_redeem(text, text, text, text) TO salut_app;
    GRANT EXECUTE ON FUNCTION loyalty_reverse_refund(bigint, integer, text, text, text) TO salut_app;
    GRANT EXECUTE ON FUNCTION loyalty_link_guest(text, text) TO salut_app;
  END IF;
END $$;
