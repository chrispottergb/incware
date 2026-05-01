ALTER TABLE public.company_assets
  ADD COLUMN IF NOT EXISTS lease_structure text DEFAULT 'modified_gross',
  ADD COLUMN IF NOT EXISTS expense_taxes_party text DEFAULT 'landlord',
  ADD COLUMN IF NOT EXISTS expense_insurance_party text DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS expense_maintenance_party text DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS market_rent_justified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS market_rent_note text;

CREATE OR REPLACE FUNCTION public.validate_lease_classification_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
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
    IF NEW.lease_structure IS NOT NULL AND NEW.lease_structure NOT IN ('modified_gross','gross','triple_net','double_net','single_net','absolute_net') THEN
      RAISE EXCEPTION 'Invalid lease_structure: %', NEW.lease_structure;
    END IF;
    IF NEW.expense_taxes_party IS NOT NULL AND NEW.expense_taxes_party NOT IN ('landlord','tenant','shared') THEN
      RAISE EXCEPTION 'Invalid expense_taxes_party: %', NEW.expense_taxes_party;
    END IF;
    IF NEW.expense_insurance_party IS NOT NULL AND NEW.expense_insurance_party NOT IN ('landlord','tenant','shared') THEN
      RAISE EXCEPTION 'Invalid expense_insurance_party: %', NEW.expense_insurance_party;
    END IF;
    IF NEW.expense_maintenance_party IS NOT NULL AND NEW.expense_maintenance_party NOT IN ('landlord','tenant','shared') THEN
      RAISE EXCEPTION 'Invalid expense_maintenance_party: %', NEW.expense_maintenance_party;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;