-- Payment ledger, provider-event deduplication and transactional email outbox.
-- Online payment state is only ever written by server code that verified a provider signature.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email text
  CHECK (customer_email IS NULL OR (length(customer_email) <= 254 AND customer_email = lower(customer_email)));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pickup'
  CHECK (payment_method IN ('pickup', 'card', 'demo'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_check CHECK (payment IN
  ('UNPAID', 'PAID_AT_PICKUP', 'DEMO_PAID', 'PAID_ONLINE', 'PAYMENT_FAILED', 'REFUND_REQUIRED'));

CREATE TABLE IF NOT EXISTS payment_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number bigint NOT NULL REFERENCES orders (number),
  provider text NOT NULL CHECK (provider = 'stripe'),
  provider_session_id text NOT NULL UNIQUE,
  checkout_url text,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'cad' CHECK (currency = 'cad'),
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PAID', 'FAILED', 'EXPIRED', 'MISMATCH')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- At most one live attempt per order keeps reconciliation unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_one_open_idx ON payment_attempts (order_number)
  WHERE status IN ('CREATED', 'PAID');

CREATE TABLE IF NOT EXISTS provider_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number bigint NOT NULL REFERENCES orders (number),
  kind text NOT NULL CHECK (kind IN ('customer_confirmation', 'store_notification', 'ready', 'cancelled')),
  recipient text NOT NULL CHECK (length(recipient) <= 254),
  locale text NOT NULL CHECK (locale IN ('fr', 'en')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (order_number, kind)
);
CREATE INDEX IF NOT EXISTS email_outbox_pending_idx ON email_outbox (id) WHERE status IN ('PENDING', 'FAILED');

-- Least privilege: the runtime role may never delete financial or audit history.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salut_app') THEN
    GRANT SELECT, INSERT, UPDATE ON payment_attempts, provider_events, email_outbox TO salut_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO salut_app;
    REVOKE DELETE ON orders, order_events, payment_attempts, provider_events, email_outbox, catalog_audit_history FROM salut_app;
  END IF;
END $$;
