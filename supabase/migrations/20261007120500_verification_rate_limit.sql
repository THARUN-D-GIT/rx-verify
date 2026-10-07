-- Restrict direct access to the QR registry and rate-limit public verification.
CREATE TABLE IF NOT EXISTS public.verification_rate_limits (
  client_hash TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts > 0)
);

CREATE INDEX IF NOT EXISTS verification_rate_limits_window_idx
  ON public.verification_rate_limits (window_started_at);

ALTER TABLE public.verification_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verification_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.verification_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_verification_attempt(p_client_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_window TIMESTAMPTZ := date_trunc('minute', now());
  current_attempts INTEGER;
BEGIN
  INSERT INTO public.verification_rate_limits AS limits
    (client_hash, window_started_at, attempts)
  VALUES (p_client_hash, active_window, 1)
  ON CONFLICT (client_hash) DO UPDATE
    SET window_started_at = CASE
          WHEN limits.window_started_at < active_window THEN active_window
          ELSE limits.window_started_at
        END,
        attempts = CASE
          WHEN limits.window_started_at < active_window THEN 1
          ELSE limits.attempts + 1
        END
  RETURNING attempts INTO current_attempts;

  DELETE FROM public.verification_rate_limits
  WHERE window_started_at < now() - INTERVAL '1 day';

  RETURN current_attempts <= 10;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_verification_attempt(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_verification_attempt(TEXT) TO service_role;

DROP POLICY IF EXISTS "Batches publicly viewable" ON public.medicine_batches;
DROP POLICY IF EXISTS "Admins view batches" ON public.medicine_batches;
CREATE POLICY "Admins view batches"
  ON public.medicine_batches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE SELECT ON public.medicine_batches FROM anon;
GRANT SELECT ON public.medicine_batches TO authenticated;

-- Retire public read access from old schema names if an earlier manual setup created them.
DO $$
BEGIN
  IF to_regclass('public.qr_verification') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS qr_verification_registry_select_public ON public.qr_verification';
    EXECUTE 'REVOKE SELECT ON public.qr_verification FROM anon, authenticated';
  END IF;

  IF to_regclass('public.inventory') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.inventory FROM anon, authenticated';
  END IF;
END
$$;
