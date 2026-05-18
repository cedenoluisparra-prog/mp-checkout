-- Constrain status to known values at the DB level
ALTER TABLE payments
  ADD CONSTRAINT chk_payments_status
  CHECK (status IN ('pending', 'processed', 'failed', 'refunded'));

-- Constrain currency to supported values
ALTER TABLE payments
  ADD CONSTRAINT chk_payments_currency
  CHECK (currency IN ('MXN', 'USD', 'ARS', 'BRL', 'COP', 'CLP', 'PEN'));

-- Ensure amount is always positive
ALTER TABLE payments
  ADD CONSTRAINT chk_payments_amount
  CHECK (amount > 0);

-- Prevent mutation of immutable business fields after creation.
-- Only status and status_detail may change after insert.
CREATE OR REPLACE FUNCTION prevent_immutable_fields_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount <> OLD.amount THEN
    RAISE EXCEPTION 'payments.amount is immutable after creation';
  END IF;
  IF NEW.external_reference <> OLD.external_reference THEN
    RAISE EXCEPTION 'payments.external_reference is immutable after creation';
  END IF;
  IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'payments.order_id is immutable after creation';
  END IF;
  IF NEW.payer_email IS DISTINCT FROM OLD.payer_email THEN
    RAISE EXCEPTION 'payments.payer_email is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_immutable_fields
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION prevent_immutable_fields_mutation();
