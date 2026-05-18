-- Explicit RLS: deny all direct table access from anon and authenticated roles.
-- Edge Functions use service_role which bypasses RLS by design in Supabase.
-- This ensures no row can be read or written directly from the client.

CREATE POLICY "deny_direct_access"
  ON payments
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
