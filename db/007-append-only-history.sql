-- Financial, loyalty and audit history is append-only. The runtime role is never granted UPDATE or DELETE on it
-- (default privileges had granted UPDATE on newly created tables), and loyalty history rejects changes outright.
CREATE OR REPLACE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'HISTORY_IS_APPEND_ONLY';
END $$;

DROP TRIGGER IF EXISTS loyalty_transactions_append_only ON loyalty_transactions;
CREATE TRIGGER loyalty_transactions_append_only BEFORE UPDATE OR DELETE ON loyalty_transactions
  FOR EACH ROW EXECUTE FUNCTION reject_history_change();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'salut_app') THEN
    REVOKE UPDATE, DELETE ON loyalty_transactions, order_events, catalog_audit_history, provider_events FROM salut_app;
  END IF;
END $$;
