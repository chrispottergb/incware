-- 1. Create unified asset transaction log table
CREATE TABLE public.asset_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text NOT NULL,
  date date,
  amount numeric,
  monthly_payment numeric,
  vendor text,
  lessor text,
  buyer text,
  financing text,
  term text,
  end_date date,
  reason text,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_asset_transactions_entity ON public.asset_transactions(entity_id);

-- 2. Grants (required: public schema has no default privileges)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_transactions TO authenticated;
GRANT ALL ON public.asset_transactions TO service_role;

-- 3. RLS
ALTER TABLE public.asset_transactions ENABLE ROW LEVEL SECURITY;

-- 4. Policies: scoped to company owner (same pattern as other company sub-tables)
CREATE POLICY "Users can manage own asset transactions"
ON public.asset_transactions
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = asset_transactions.entity_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = asset_transactions.entity_id AND c.user_id = auth.uid()));

-- 5. Validation trigger for type (trigger preferred over CHECK per project conventions)
CREATE OR REPLACE FUNCTION public.validate_asset_transaction_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type NOT IN ('purchase','lease','vehicle_sale','lease_termination') THEN
    RAISE EXCEPTION 'Invalid asset transaction type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_asset_transaction_type_trigger
BEFORE INSERT OR UPDATE ON public.asset_transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_asset_transaction_type();

-- 6. updated_at trigger
CREATE TRIGGER update_asset_transactions_updated_at
BEFORE UPDATE ON public.asset_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Migrate legacy data (joined through meetings for company id)
-- Purchases
INSERT INTO public.asset_transactions (entity_id, type, description, date, amount, vendor, financing, resolution, created_at)
SELECT m.company_id, 'purchase',
       COALESCE(NULLIF(TRIM(p.year_make_model), ''), 'Asset') || CASE WHEN p.asset_type IS NOT NULL AND p.asset_type <> '' THEN ' (' || p.asset_type || ')' ELSE '' END,
       p.date, p.amount, p.seller, NULL, NULL, COALESCE(p.created_at, now())
FROM public.meeting_vehicle_purchases p
JOIN public.meetings m ON m.id = p.meeting_id;

-- Leases
INSERT INTO public.asset_transactions (entity_id, type, description, date, monthly_payment, lessor, term, end_date, created_at)
SELECT m.company_id, 'lease',
       COALESCE(NULLIF(TRIM(l.year_make_model), ''), 'Leased asset') || CASE WHEN l.asset_type IS NOT NULL AND l.asset_type <> '' THEN ' (' || l.asset_type || ')' ELSE '' END,
       l.lease_start_date, l.monthly_lease_payment, l.lessor_name,
       CASE WHEN l.lease_start_date IS NOT NULL AND l.lease_end_date IS NOT NULL
            THEN ((l.lease_end_date - l.lease_start_date) / 30)::text || ' months'
            ELSE NULL END,
       l.lease_end_date, COALESCE(l.created_at, now())
FROM public.meeting_vehicle_leases l
JOIN public.meetings m ON m.id = l.meeting_id;

-- Vehicle sales
INSERT INTO public.asset_transactions (entity_id, type, description, date, amount, buyer, reason, created_at)
SELECT m.company_id, 'vehicle_sale',
       COALESCE(NULLIF(TRIM(s.year_make_model), ''), 'Vehicle'),
       s.sale_date, s.sale_price, s.buyer_name, NULLIF(TRIM(COALESCE(s.reason_for_sale, '')), ''), COALESCE(s.created_at, now())
FROM public.meeting_vehicle_sales s
JOIN public.meetings m ON m.id = s.meeting_id;

-- Lease terminations
INSERT INTO public.asset_transactions (entity_id, type, description, date, lessor, reason, created_at)
SELECT m.company_id, 'lease_termination',
       COALESCE(NULLIF(TRIM(t.property_description), ''), 'Leased asset'),
       t.lease_end_date, t.landlord_name,
       NULLIF(TRIM(CONCAT_WS(' — ', NULLIF(TRIM(COALESCE(t.termination_reason,'')), ''), NULLIF(TRIM(COALESCE(t.notes,'')), ''))), ''),
       COALESCE(t.created_at, now())
FROM public.meeting_lease_terminations t
JOIN public.meetings m ON m.id = t.meeting_id;