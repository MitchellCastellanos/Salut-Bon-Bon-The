CREATE TABLE IF NOT EXISTS orders (
  number bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid UNIQUE NOT NULL,
  request_fingerprint text NOT NULL,
  tracking_token text UNIQUE NOT NULL,
  locale text NOT NULL CHECK (locale IN ('fr', 'en')),
  customer text NOT NULL,
  notes text NOT NULL,
  pickup_at timestamptz NOT NULL,
  items jsonb NOT NULL,
  total integer NOT NULL CHECK (total > 0),
  payment text NOT NULL CHECK (payment IN ('UNPAID', 'PAID_AT_PICKUP', 'DEMO_PAID')),
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_pickup_idx ON orders (pickup_at) WHERE status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE TABLE IF NOT EXISTS order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number bigint NOT NULL REFERENCES orders(number),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
