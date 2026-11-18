-- Customer accounts, Récompenses Salut / Salut Rewards, and a shared rate limiter.
-- No gift-card objects belong here (reserved for a future phase).
UPDATE "user" SET "emailVerified" = true WHERE "role" IN ('STAFF', 'ADMIN');

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_user_id text REFERENCES "user" ("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_user_id, created_at DESC) WHERE customer_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL CHECK (hits > 0)
);

-- Safe by default: inactive, no earning rate, no rewards. The owner configures everything in /admin/rewards.
CREATE TABLE IF NOT EXISTS loyalty_program (
  id integer PRIMARY KEY CHECK (id = 1),
  active boolean NOT NULL DEFAULT false,
  points_per_dollar integer CHECK (points_per_dollar BETWEEN 1 AND 100),
  earn_categories text[],
  min_order_cents integer NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
INSERT INTO loyalty_program (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{1,48}$'),
  name_fr text NOT NULL CHECK (length(name_fr) BETWEEN 1 AND 120),
  name_en text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 120),
  description_fr text NOT NULL DEFAULT '' CHECK (length(description_fr) <= 400),
  description_en text NOT NULL DEFAULT '' CHECK (length(description_en) <= 400),
  points_cost integer NOT NULL CHECK (points_cost BETWEEN 1 AND 100000),
  available boolean NOT NULL DEFAULT false,
  eligible_category text REFERENCES catalog_categories (id),
  eligible_product_id text REFERENCES catalog_products (id),
  CHECK (eligible_category IS NULL OR eligible_product_id IS NULL),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES "user" ("id") ON DELETE CASCADE,
  member_code text NOT NULL UNIQUE CHECK (member_code ~ '^[A-Z2-9]{8}$'),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  enrolled_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES loyalty_accounts (id),
  kind text NOT NULL CHECK (kind IN ('earn', 'redeem', 'adjust')),
  points integer NOT NULL CHECK (points <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  order_number bigint REFERENCES orders (number),
  reward_id text REFERENCES loyalty_rewards (id),
  reward_name text,
  reason text CHECK (reason IS NULL OR length(reason) <= 300),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'redeem' OR points < 0),
  CHECK (kind <> 'earn' OR points > 0),
  CHECK (kind <> 'adjust' OR (reason IS NOT NULL AND length(reason) >= 3))
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_one_earn_per_order ON loyalty_transactions (order_number)
  WHERE kind = 'earn' AND order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS loyalty_transactions_account_idx ON loyalty_transactions (account_id, id DESC);

-- Short-lived, single-use identification tokens. Only a SHA-256 hash is stored; the QR carries the random token.
CREATE TABLE IF NOT EXISTS loyalty_qr_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES loyalty_accounts (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_qr_tokens_account_idx ON loyalty_qr_tokens (account_id, created_at DESC);

-- Every balance change goes through this function: row-locked, idempotent, never negative.
CREATE OR REPLACE FUNCTION loyalty_post(
  p_account uuid, p_kind text, p_points integer, p_key text, p_order bigint,
  p_reward text, p_reward_name text, p_reason text, p_actor text
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
  INSERT INTO loyalty_transactions (account_id, kind, points, balance_after, idempotency_key, order_number, reward_id, reward_name, reason, actor)
  VALUES (p_account, p_kind, p_points, next_balance, p_key, p_order, p_reward, p_reward_name, p_reason, p_actor)
  RETURNING id INTO new_id;
  UPDATE loyalty_accounts SET balance = next_balance, lifetime_earned = lifetime_earned + GREATEST(p_points, 0) WHERE id = p_account;
  RETURN QUERY SELECT false, next_balance, new_id;
END $$;

-- Redeems one reward against a single-use QR token. The token row is locked first, then the account row.
CREATE OR REPLACE FUNCTION loyalty_redeem(p_token_hash text, p_reward text, p_key text, p_actor text)
RETURNS TABLE (o_duplicate boolean, o_balance integer, o_txn bigint, o_reward text)
LANGUAGE plpgsql AS $$
DECLARE tok loyalty_qr_tokens%ROWTYPE; rw loyalty_rewards%ROWTYPE; prior loyalty_transactions%ROWTYPE; res record;
BEGIN
  SELECT * INTO tok FROM loyalty_qr_tokens WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QR_INVALID'; END IF;
  SELECT * INTO prior FROM loyalty_transactions WHERE idempotency_key = p_key AND account_id = tok.account_id AND kind = 'redeem';
  IF FOUND THEN RETURN QUERY SELECT true, prior.balance_after, prior.id, prior.reward_name; RETURN; END IF;
  IF tok.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'QR_USED'; END IF;
  IF tok.expires_at < now() THEN RAISE EXCEPTION 'QR_EXPIRED'; END IF;
  IF NOT (SELECT active FROM loyalty_program WHERE id = 1) THEN RAISE EXCEPTION 'PROGRAM_INACTIVE'; END IF;
  SELECT * INTO rw FROM loyalty_rewards WHERE id = p_reward AND available;
  IF NOT FOUND THEN RAISE EXCEPTION 'REWARD_UNAVAILABLE'; END IF;
  SELECT * INTO res FROM loyalty_post(tok.account_id, 'redeem', -rw.points_cost, p_key, NULL, rw.id, rw.name_en, NULL, p_actor);
  UPDATE loyalty_qr_tokens SET redeemed_at = now() WHERE id = tok.id;
  RETURN QUERY SELECT res.o_duplicate, res.o_balance, res.o_txn, rw.name_en;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salut_app') THEN
    GRANT SELECT, INSERT, UPDATE ON rate_limits, loyalty_program, loyalty_accounts, loyalty_qr_tokens TO salut_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON loyalty_rewards TO salut_app;
    GRANT SELECT, INSERT ON loyalty_transactions TO salut_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO salut_app;
    GRANT EXECUTE ON FUNCTION loyalty_post(uuid, text, integer, text, bigint, text, text, text, text) TO salut_app;
    GRANT EXECUTE ON FUNCTION loyalty_redeem(text, text, text, text) TO salut_app;
    REVOKE DELETE ON loyalty_accounts, loyalty_transactions, loyalty_qr_tokens FROM salut_app;
  END IF;
END $$;
