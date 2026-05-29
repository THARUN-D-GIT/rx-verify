-- =============================================================================
-- MediVerify — Core PostgreSQL / Supabase Schema
-- Medicine availability & counterfeit verification system
--
-- Tables: medicines, pharmacies, inventory, reservations, qr_verification
-- Run in Supabase SQL Editor or via: supabase db push / migration apply
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. MEDICINES — product catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.medicines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  generic_name  TEXT,
  manufacturer  TEXT,
  description   TEXT,
  category      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON public.medicines (name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic_name ON public.medicines (generic_name);

-- ---------------------------------------------------------------------------
-- 2. PHARMACIES — retail locations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT NOT NULL,
  city        TEXT NOT NULL,
  phone       TEXT,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  owner_id    UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacies_city ON public.pharmacies (city);
CREATE INDEX IF NOT EXISTS idx_pharmacies_owner_id ON public.pharmacies (owner_id);

-- ---------------------------------------------------------------------------
-- 3. INVENTORY — stock levels per pharmacy (pharmacy ↔ medicine M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id         UUID NOT NULL REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  medicine_id         UUID NOT NULL REFERENCES public.medicines (id) ON DELETE CASCADE,
  quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  price               NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT inventory_pharmacy_medicine_unique UNIQUE (pharmacy_id, medicine_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_pharmacy_id ON public.inventory (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_inventory_medicine_id ON public.inventory (medicine_id);
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON public.inventory (quantity) WHERE quantity > 0;

-- ---------------------------------------------------------------------------
-- 4. RESERVATIONS — user holds on pharmacy stock
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  pharmacy_id  UUID NOT NULL REFERENCES public.pharmacies (id) ON DELETE CASCADE,
  medicine_id  UUID NOT NULL REFERENCES public.medicines (id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'ready', 'cancelled', 'completed')),
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON public.reservations (user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_pharmacy_id ON public.reservations (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_reservations_medicine_id ON public.reservations (medicine_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations (status);

-- ---------------------------------------------------------------------------
-- 5. QR_VERIFICATION — authentic QR registry + scan audit trail
--
--    Registry rows: is_registry = true  (one row per authentic batch/QR)
--    Scan log rows:  is_registry = false (one row per verification attempt)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_verification (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id       UUID REFERENCES public.medicines (id) ON DELETE CASCADE,
  batch_number      TEXT,
  qr_code           TEXT NOT NULL,
  manufactured_date DATE,
  expiry_date       DATE,
  is_valid          BOOLEAN NOT NULL DEFAULT true,
  is_registry       BOOLEAN NOT NULL DEFAULT false,
  user_id           UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  result            TEXT CHECK (result IN ('authentic', 'invalid', 'expired')),
  scanned_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT qr_verification_registry_requires_medicine
    CHECK (is_registry = false OR medicine_id IS NOT NULL),
  CONSTRAINT qr_verification_scan_requires_result
    CHECK (is_registry = true OR (result IS NOT NULL AND scanned_at IS NOT NULL))
);

-- One registry row per batch / QR code; scan logs may repeat the same qr_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_verification_registry_batch
  ON public.qr_verification (batch_number) WHERE is_registry = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_verification_registry_qr
  ON public.qr_verification (qr_code) WHERE is_registry = true;

CREATE INDEX IF NOT EXISTS idx_qr_verification_qr_code ON public.qr_verification (qr_code);
CREATE INDEX IF NOT EXISTS idx_qr_verification_medicine_id ON public.qr_verification (medicine_id);
CREATE INDEX IF NOT EXISTS idx_qr_verification_is_registry ON public.qr_verification (is_registry);
CREATE INDEX IF NOT EXISTS idx_qr_verification_scanned_at ON public.qr_verification (scanned_at DESC)
  WHERE is_registry = false;

-- ---------------------------------------------------------------------------
-- Auto-update updated_at on row changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pharmacies_updated_at
  BEFORE UPDATE ON public.pharmacies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_qr_verification_updated_at
  BEFORE UPDATE ON public.qr_verification
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (Supabase)
-- ---------------------------------------------------------------------------
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_verification ENABLE ROW LEVEL SECURITY;

-- Public read for catalog / availability / QR lookup
CREATE POLICY "medicines_select_public"
  ON public.medicines FOR SELECT USING (true);

CREATE POLICY "pharmacies_select_public"
  ON public.pharmacies FOR SELECT USING (true);

CREATE POLICY "inventory_select_public"
  ON public.inventory FOR SELECT USING (true);

CREATE POLICY "qr_verification_registry_select_public"
  ON public.qr_verification FOR SELECT
  USING (is_registry = true);

-- Authenticated users manage their own reservations
CREATE POLICY "reservations_select_own"
  ON public.reservations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "reservations_insert_own"
  ON public.reservations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reservations_update_own"
  ON public.reservations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Anyone can log a QR scan (anon + authenticated)
CREATE POLICY "qr_verification_scan_insert"
  ON public.qr_verification FOR INSERT
  WITH CHECK (is_registry = false);

-- Grants for Supabase roles
GRANT SELECT ON public.medicines, public.pharmacies, public.inventory TO anon, authenticated;
GRANT SELECT ON public.qr_verification TO anon, authenticated;
GRANT INSERT ON public.qr_verification TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reservations TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
