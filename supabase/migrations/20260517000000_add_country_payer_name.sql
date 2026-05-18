ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS country    TEXT,
  ADD COLUMN IF NOT EXISTS payer_name TEXT;

-- Extend immutability: country and payer_name must not change after creation
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
  IF NEW.country IS DISTINCT FROM OLD.country THEN
    RAISE EXCEPTION 'payments.country is immutable after creation';
  END IF;
  IF NEW.payer_name IS DISTINCT FROM OLD.payer_name THEN
    RAISE EXCEPTION 'payments.payer_name is immutable after creation';
  END IF;
  RETURN NEW;
END;
$$;
