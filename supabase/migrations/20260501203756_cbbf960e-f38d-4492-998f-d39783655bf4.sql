-- Extend company_assets for lease classification
ALTER TABLE public.company_assets
  ADD COLUMN IF NOT EXISTS landlord_party_kind text,
  ADD COLUMN IF NOT EXISTS landlord_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landlord_shareholder_id uuid REFERENCES public.shareholders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_party_kind text,
  ADD COLUMN IF NOT EXISTS tenant_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_shareholder_id uuid REFERENCES public.shareholders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lease_classification text,
  ADD COLUMN IF NOT EXISTS classification_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS rent_frequency text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS generated_lease_text text,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

-- Validation: classification + party_kind value sets (via trigger to allow nulls + flexibility)
CREATE OR REPLACE FUNCTION public.validate_lease_classification_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.asset_type = 'lease' THEN
    IF NEW.landlord_party_kind IS NOT NULL AND NEW.landlord_party_kind NOT IN ('individual','company','external') THEN
      RAISE EXCEPTION 'Invalid landlord_party_kind: %', NEW.landlord_party_kind;
    END IF;
    IF NEW.tenant_party_kind IS NOT NULL AND NEW.tenant_party_kind NOT IN ('individual','company','external') THEN
      RAISE EXCEPTION 'Invalid tenant_party_kind: %', NEW.tenant_party_kind;
    END IF;
    IF NEW.lease_classification IS NOT NULL AND NEW.lease_classification NOT IN ('standard','related_party','self_rental','intercompany') THEN
      RAISE EXCEPTION 'Invalid lease_classification: %', NEW.lease_classification;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lease_classification_fields ON public.company_assets;
CREATE TRIGGER trg_validate_lease_classification_fields
BEFORE INSERT OR UPDATE ON public.company_assets
FOR EACH ROW EXECUTE FUNCTION public.validate_lease_classification_fields();

-- New table: lease_clauses
CREATE TABLE IF NOT EXISTS public.lease_clauses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id uuid NOT NULL REFERENCES public.company_assets(id) ON DELETE CASCADE,
  clause_type text NOT NULL DEFAULT 'custom',
  clause_title text,
  clause_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_auto_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_clauses_lease_id ON public.lease_clauses(lease_id);

ALTER TABLE public.lease_clauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lease clauses"
ON public.lease_clauses
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.company_assets ca
  JOIN public.companies c ON c.id = ca.company_id
  WHERE ca.id = lease_clauses.lease_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_assets ca
  JOIN public.companies c ON c.id = ca.company_id
  WHERE ca.id = lease_clauses.lease_id AND c.user_id = auth.uid()
));

CREATE TRIGGER update_lease_clauses_updated_at
BEFORE UPDATE ON public.lease_clauses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- New table: lease_classification_audit
CREATE TABLE IF NOT EXISTS public.lease_classification_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lease_id uuid NOT NULL REFERENCES public.company_assets(id) ON DELETE CASCADE,
  old_classification text,
  new_classification text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lease_classification_audit_lease_id ON public.lease_classification_audit(lease_id);

ALTER TABLE public.lease_classification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lease audit"
ON public.lease_classification_audit
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.company_assets ca
  JOIN public.companies c ON c.id = ca.company_id
  WHERE ca.id = lease_classification_audit.lease_id AND c.user_id = auth.uid()
));

CREATE POLICY "Users can insert own lease audit"
ON public.lease_classification_audit
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.company_assets ca
  JOIN public.companies c ON c.id = ca.company_id
  WHERE ca.id = lease_classification_audit.lease_id AND c.user_id = auth.uid()
));

-- App setting for related-party threshold (idempotent)
INSERT INTO public.app_settings (key, value)
VALUES ('related_party_threshold_pct', '25')
ON CONFLICT (key) DO NOTHING;