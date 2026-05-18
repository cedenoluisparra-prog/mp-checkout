CREATE TABLE IF NOT EXISTS payments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           TEXT        UNIQUE,
  payment_id         TEXT,
  external_reference UUID        NOT NULL,
  amount             NUMERIC(12,2) NOT NULL,
  currency           TEXT        NOT NULL DEFAULT 'MXN',
  status             TEXT        NOT NULL DEFAULT 'pending',
  status_detail      TEXT,
  payer_email        TEXT,
  payment_method_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id
  ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_external_reference
  ON payments(external_reference);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON payments(status);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
