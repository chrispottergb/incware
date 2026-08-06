CREATE TABLE public.shareholder_name_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id uuid NOT NULL REFERENCES public.shareholders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  previous_name text NOT NULL,
  new_name text NOT NULL,
  effective_date date,
  reason text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shareholder_name_history TO authenticated;
GRANT ALL ON public.shareholder_name_history TO service_role;

ALTER TABLE public.shareholder_name_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage name history for their companies"
ON public.shareholder_name_history
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = shareholder_name_history.company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = shareholder_name_history.company_id AND c.user_id = auth.uid()));

CREATE INDEX idx_shareholder_name_history_shareholder ON public.shareholder_name_history(shareholder_id);
CREATE INDEX idx_shareholder_name_history_company ON public.shareholder_name_history(company_id);

CREATE TRIGGER update_shareholder_name_history_updated_at
BEFORE UPDATE ON public.shareholder_name_history
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.shareholders
  ADD COLUMN IF NOT EXISTS holder_subtype text,
  ADD COLUMN IF NOT EXISTS trust_revocability text,
  ADD COLUMN IF NOT EXISTS trustee_name text,
  ADD COLUMN IF NOT EXISTS predecessor_shareholder_id uuid REFERENCES public.shareholders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.recalculate_ownership_percentages(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_units NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution', 'opening_balance') THEN num_shares
      WHEN transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -num_shares
      ELSE 0
    END
  ), 0) INTO total_units
  FROM share_transactions
  WHERE company_id = p_company_id
    AND status != 'corrected'
    AND effective_date <= CURRENT_DATE;

  IF total_units > 0 THEN
    UPDATE shareholders s
    SET ownership_percentage = ROUND(
      (
        SELECT COALESCE(SUM(units), 0) FROM (
          SELECT CASE 
            WHEN st.transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution', 'opening_balance') THEN st.num_shares
            WHEN st.transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -st.num_shares
            ELSE 0
          END AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id = s.id
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
          
          UNION ALL
          
          SELECT st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id IS DISTINCT FROM s.id
            AND LOWER(TRIM(st.to_shareholder)) IN (
              SELECT LOWER(TRIM(s.name))
              UNION
              SELECT LOWER(TRIM(h.previous_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
              UNION
              SELECT LOWER(TRIM(h.new_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
            )
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer In')
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
          
          UNION ALL
          
          SELECT -st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND LOWER(TRIM(st.from_shareholder)) IN (
              SELECT LOWER(TRIM(s.name))
              UNION
              SELECT LOWER(TRIM(h.previous_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
              UNION
              SELECT LOWER(TRIM(h.new_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
            )
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer Out')
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
        ) sub
      ) / total_units * 100, 2
    )
    WHERE s.company_id = p_company_id;
  ELSE
    UPDATE shareholders
    SET ownership_percentage = NULL
    WHERE company_id = p_company_id;
  END IF;
END;
$function$;