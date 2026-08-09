-- Phase 1: Opening Ownership Snapshot (unit basis)
-- Additive only. New tables + new nullable columns. No drops, no type changes.

-- 1. Per-entity feature flag (default off)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ownership_snapshot_enabled boolean NOT NULL DEFAULT false;

-- 2. Holder capacity + succession (canonical holder record stays `shareholders`)
ALTER TABLE public.shareholders
  ADD COLUMN IF NOT EXISTS capacity_description text;

-- 3. Auxiliary alphanumeric certificate label (integer certificate_number stays authoritative)
ALTER TABLE public.stock_certificates
  ADD COLUMN IF NOT EXISTS certificate_label text;
ALTER TABLE public.share_transactions
  ADD COLUMN IF NOT EXISTS certificate_label text;

-- 4. Snapshot header
CREATE TABLE IF NOT EXISTS public.ownership_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  share_class_key text NOT NULL DEFAULT 'common',
  share_class_label text NOT NULL DEFAULT 'Common',
  as_of_date date NOT NULL,
  quantity_basis text NOT NULL DEFAULT 'units'
    CHECK (quantity_basis IN ('units','shares','percentage','capital_account')),
  entry_tier text NOT NULL DEFAULT 'position_lots'
    CHECK (entry_tier IN ('declared_total','position_lots','full_history')),
  declared_total numeric(18,4),
  highest_certificate_number_issued text,
  suggested_next_certificate_number text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','locked','amended')),
  supersedes_id uuid REFERENCES public.ownership_snapshots(id) ON DELETE SET NULL,
  locked_at timestamptz,
  locked_by uuid,
  source_document_id uuid,
  reconciliation_note text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Conditional CHECK: a locked snapshot must record why, and by whom
  CONSTRAINT ownership_snapshots_locked_fields
    CHECK (status <> 'locked' OR (locked_at IS NOT NULL AND declared_total IS NOT NULL))
);

-- Phase 1 ships unit basis only; percentage/capital_account remain schema-ready but unreachable.
ALTER TABLE public.ownership_snapshots
  ADD CONSTRAINT ownership_snapshots_phase1_basis
  CHECK (quantity_basis IN ('units','shares'));

-- One locked snapshot per (company, class)
CREATE UNIQUE INDEX IF NOT EXISTS ownership_snapshots_one_locked_per_class
  ON public.ownership_snapshots (company_id, share_class_key)
  WHERE status = 'locked';

CREATE INDEX IF NOT EXISTS ownership_snapshots_company_idx
  ON public.ownership_snapshots (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ownership_snapshots TO authenticated;
GRANT ALL ON public.ownership_snapshots TO service_role;
ALTER TABLE public.ownership_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage ownership snapshots for their companies"
  ON public.ownership_snapshots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ownership_snapshots.company_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ownership_snapshots.company_id AND c.user_id = auth.uid()));

-- 5. Snapshot lots — immutable audit evidence beside the authoritative ledger row
CREATE TABLE IF NOT EXISTS public.ownership_snapshot_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.ownership_snapshots(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shareholder_id uuid REFERENCES public.shareholders(id) ON DELETE SET NULL,
  holder_name_as_entered text NOT NULL,
  -- precision matches share_transactions.num_shares exactly (18,4)
  entered_quantity numeric(18,4) NOT NULL,
  certificate_number integer,
  certificate_label text,
  certificate_date date,
  acquired_date date,
  acquisition_type text NOT NULL DEFAULT 'original_issue'
    CHECK (acquisition_type IN ('original_issue','gift','purchase','transfer','conversion','reissue_on_consolidation','inheritance','contribution','other')),
  transferor_description text,
  consideration_paid numeric(18,2),
  status text NOT NULL DEFAULT 'outstanding'
    CHECK (status IN ('outstanding','surrendered')),
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  -- Deferred link: back-filled and asserted non-null inside the lock transaction
  share_transaction_id uuid REFERENCES public.share_transactions(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One lot per generated ledger row
CREATE UNIQUE INDEX IF NOT EXISTS ownership_snapshot_lots_one_per_ledger_row
  ON public.ownership_snapshot_lots (share_transaction_id)
  WHERE share_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ownership_snapshot_lots_snapshot_idx
  ON public.ownership_snapshot_lots (snapshot_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ownership_snapshot_lots TO authenticated;
GRANT ALL ON public.ownership_snapshot_lots TO service_role;
ALTER TABLE public.ownership_snapshot_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage ownership snapshot lots for their companies"
  ON public.ownership_snapshot_lots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ownership_snapshot_lots.company_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ownership_snapshot_lots.company_id AND c.user_id = auth.uid()));

-- 6. Retired records — display-only archive, excluded from all math
CREATE TABLE IF NOT EXISTS public.retired_ownership_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.ownership_snapshots(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_number integer,
  certificate_label text,
  holder_name text NOT NULL,
  quantity numeric(18,4),
  issue_date date,
  surrender_date date,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retired_ownership_records_snapshot_idx
  ON public.retired_ownership_records (snapshot_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retired_ownership_records TO authenticated;
GRANT ALL ON public.retired_ownership_records TO service_role;
ALTER TABLE public.retired_ownership_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage retired ownership records for their companies"
  ON public.retired_ownership_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = retired_ownership_records.company_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = retired_ownership_records.company_id AND c.user_id = auth.uid()));

-- 7. updated_at triggers (reuse existing function)
DROP TRIGGER IF EXISTS set_ownership_snapshots_updated_at ON public.ownership_snapshots;
CREATE TRIGGER set_ownership_snapshots_updated_at
  BEFORE UPDATE ON public.ownership_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_ownership_snapshot_lots_updated_at ON public.ownership_snapshot_lots;
CREATE TRIGGER set_ownership_snapshot_lots_updated_at
  BEFORE UPDATE ON public.ownership_snapshot_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Locked snapshots are immutable: block edits to locked rows and their lots
CREATE OR REPLACE FUNCTION public.block_locked_snapshot_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'ownership_snapshots' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.status = 'locked' THEN
        RAISE EXCEPTION 'Locked ownership snapshots cannot be deleted. Create an amendment instead.';
      END IF;
      RETURN OLD;
    END IF;
    -- allow transitioning locked -> amended only
    IF OLD.status = 'locked' AND NEW.status <> 'amended' THEN
      RAISE EXCEPTION 'Locked ownership snapshots are immutable. Create an amendment instead.';
    END IF;
    RETURN NEW;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.ownership_snapshots s
      WHERE s.id = COALESCE(NEW.snapshot_id, OLD.snapshot_id) AND s.status = 'locked'
    ) THEN
      RAISE EXCEPTION 'Lots of a locked ownership snapshot are immutable.';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.block_locked_snapshot_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_locked_snapshot ON public.ownership_snapshots;
CREATE TRIGGER guard_locked_snapshot
  BEFORE UPDATE OR DELETE ON public.ownership_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_snapshot_changes();

DROP TRIGGER IF EXISTS guard_locked_snapshot_lots ON public.ownership_snapshot_lots;
CREATE TRIGGER guard_locked_snapshot_lots
  BEFORE UPDATE OR DELETE ON public.ownership_snapshot_lots
  FOR EACH ROW EXECUTE FUNCTION public.block_locked_snapshot_changes();