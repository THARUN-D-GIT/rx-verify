-- Align legacy schema names with the application tables and tighten profile visibility.
-- Existing data in the former inventory / QR registry tables is copied forward when present.

DO $$
BEGIN
  IF to_regclass('public.inventory') IS NOT NULL THEN
    INSERT INTO public.pharmacy_inventory AS current_inventory
      (pharmacy_id, medicine_id, quantity, price, low_stock_threshold, updated_at)
    SELECT
      old_inventory.pharmacy_id,
      old_inventory.medicine_id,
      old_inventory.quantity,
      old_inventory.price,
      old_inventory.low_stock_threshold,
      COALESCE(old_inventory.updated_at, now())
    FROM public.inventory AS old_inventory
    ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE
      SET quantity = EXCLUDED.quantity,
          price = EXCLUDED.price,
          low_stock_threshold = EXCLUDED.low_stock_threshold,
          updated_at = EXCLUDED.updated_at
      WHERE EXCLUDED.updated_at > current_inventory.updated_at;
  END IF;

  IF to_regclass('public.qr_verification') IS NOT NULL THEN
    INSERT INTO public.medicine_batches
      (medicine_id, batch_number, qr_code, manufactured_date, expiry_date, is_valid)
    SELECT
      old_qr.medicine_id,
      old_qr.batch_number,
      old_qr.qr_code,
      old_qr.manufactured_date,
      old_qr.expiry_date,
      old_qr.is_valid
    FROM public.qr_verification AS old_qr
    WHERE old_qr.is_registry = true
      AND old_qr.medicine_id IS NOT NULL
      AND old_qr.batch_number IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.verification_logs (qr_code, user_id, result, scanned_at)
    SELECT old_qr.qr_code, old_qr.user_id, old_qr.result, old_qr.scanned_at
    FROM public.qr_verification AS old_qr
    WHERE old_qr.is_registry = false
      AND old_qr.result IS NOT NULL
      AND old_qr.scanned_at IS NOT NULL;
  END IF;
END
$$;

DROP POLICY IF EXISTS "Profiles are viewable by everyone authenticated" ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Pharmacy owners view reservation profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reservations AS r
      JOIN public.pharmacies AS p ON p.id = r.pharmacy_id
      WHERE r.user_id = profiles.id
        AND p.owner_id = auth.uid()
    )
  );
