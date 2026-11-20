-- Salut Plus completion (additive; nothing here changes the meaning of earlier migrations).
-- 1. A simulated payment provider so the whole checkout can be demonstrated without Stripe (Stripe stays supported).
-- 2. Free-drink value ceiling and a switch for redeeming through the stable member identifier.
-- 3. Stable, opaque, revocable member identification (used by the card QR and the Apple Wallet pass), separate from the
--    5-minute single-use redemption token.
-- 4. Apple Wallet pass records and device registrations (no credentials are ever stored here).
-- 5. Customer favorites.
-- 6. Refund records and the REFUNDED payment state.

ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS payment_attempts_provider_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_provider_check CHECK (provider IN ('stripe', 'simulated'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK (payment IN
  ('UNPAID', 'PAID_AT_PICKUP', 'DEMO_PAID', 'PAID_ONLINE', 'PAYMENT_FAILED', 'REFUND_REQUIRED', 'REFUNDED'));

CREATE TABLE IF NOT EXISTS order_refunds (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number bigint NOT NULL REFERENCES orders (number),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 280),
  provider text NOT NULL CHECK (provider IN ('simulated', 'stripe', 'manual')),
  provider_ref text,
  idempotency_key text NOT NULL UNIQUE,
  actor text NOT NULL CHECK (length(actor) <= 64),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_refunds_order_idx ON order_refunds (order_number);

-- Free drink: worth at most this many cents (regular size price). 799 is the middle of the three confirmed price tiers
-- ($5.99, $7.99, $8.99) and is editable by an ADMIN.
ALTER TABLE loyalty_program ADD COLUMN IF NOT EXISTS free_drink_max_cents integer CHECK (free_drink_max_cents IS NULL OR free_drink_max_cents > 0);
ALTER TABLE loyalty_program ADD COLUMN IF NOT EXISTS identifier_redemption boolean NOT NULL DEFAULT true;
UPDATE loyalty_program SET free_drink_max_cents = 799 WHERE id = 1 AND free_drink_max_cents IS NULL;

-- Stable member identification. The public barcode value is derived on the server from `serial` and `version` with a
-- server key, so nothing secret is stored here; rotating bumps `version`, revoking sets `revoked_at`.
CREATE TABLE IF NOT EXISTS loyalty_identifiers (
  account_id uuid PRIMARY KEY REFERENCES loyalty_accounts (id) ON DELETE CASCADE,
  serial text NOT NULL UNIQUE CHECK (serial ~ '^[A-Z2-9]{12}$'),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

-- Apple Wallet. `serial` is the pass serial number; the web-service auth token is stored only as a hash.
CREATE TABLE IF NOT EXISTS wallet_passes (
  account_id uuid PRIMARY KEY REFERENCES loyalty_accounts (id) ON DELETE CASCADE,
  serial text NOT NULL UNIQUE CHECK (serial ~ '^[0-9a-f]{32}$'),
  auth_token_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  downloads integer NOT NULL DEFAULT 0,
  lang text NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr', 'en')),
  voided_at timestamptz,
  last_error text CHECK (last_error IS NULL OR length(last_error) <= 200)
);
CREATE TABLE IF NOT EXISTS wallet_registrations (
  device_id text NOT NULL CHECK (length(device_id) BETWEEN 1 AND 128),
  serial text NOT NULL REFERENCES wallet_passes (serial) ON DELETE CASCADE,
  push_token text NOT NULL CHECK (length(push_token) <= 256),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, serial)
);

CREATE TABLE IF NOT EXISTS customer_favorites (
  user_id text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES catalog_products (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- Redemption at the counter for a member identified by the stable identifier (a staff member confirms; the short-lived
-- single-use code is not consumed). Same checks and the same ledger function as loyalty_redeem, so every guarantee holds.
CREATE OR REPLACE FUNCTION loyalty_redeem_member(p_account uuid, p_reward text, p_key text, p_actor text)
RETURNS TABLE (o_duplicate boolean, o_balance integer, o_txn bigint, o_reward text)
LANGUAGE plpgsql AS $$
DECLARE rw loyalty_rewards%ROWTYPE; prior loyalty_transactions%ROWTYPE; res record; prog loyalty_program%ROWTYPE;
BEGIN
  SELECT * INTO prior FROM loyalty_transactions WHERE idempotency_key = p_key AND account_id = p_account AND kind = 'redeem';
  IF FOUND THEN RETURN QUERY SELECT true, prior.balance_after, prior.id, prior.reward_name; RETURN; END IF;
  SELECT * INTO prog FROM loyalty_program WHERE id = 1;
  IF NOT prog.active THEN RAISE EXCEPTION 'PROGRAM_INACTIVE'; END IF;
  IF NOT prog.redemption_enabled THEN RAISE EXCEPTION 'REDEMPTION_DISABLED'; END IF;
  IF NOT prog.identifier_redemption THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  SELECT * INTO rw FROM loyalty_rewards WHERE id = p_reward AND available;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_UNAVAILABLE'; END IF;
  SELECT * INTO res FROM loyalty_post(p_account, 'redeem', -rw.points_cost, p_key, NULL, rw.id, rw.name_en, NULL, p_actor);
  RETURN QUERY SELECT res.o_duplicate, res.o_balance, res.o_txn, rw.name_en;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salut_app') THEN
    GRANT SELECT, INSERT, UPDATE ON loyalty_identifiers, wallet_passes TO salut_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON wallet_registrations, customer_favorites TO salut_app;
    GRANT SELECT, INSERT ON order_refunds TO salut_app;
    GRANT SELECT, INSERT, UPDATE ON loyalty_program TO salut_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO salut_app;
    REVOKE DELETE ON order_refunds, loyalty_identifiers, wallet_passes FROM salut_app;
  END IF;
END $$;
