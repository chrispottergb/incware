
-- Phase 1a: Add ownership_percentage to shareholders
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS ownership_percentage NUMERIC DEFAULT NULL;

-- Phase 1b: Add transaction_id linking column to bills_of_sale
ALTER TABLE public.bills_of_sale ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.share_transactions(id) ON DELETE SET NULL;

-- Phase 1c: Add bill_of_sale_id linking column to share_transactions
ALTER TABLE public.share_transactions ADD COLUMN IF NOT EXISTS bill_of_sale_id UUID REFERENCES public.bills_of_sale(id) ON DELETE SET NULL;

-- Phase 1d: Add transferred_certificate_id to share_transactions
ALTER TABLE public.share_transactions ADD COLUMN IF NOT EXISTS transferred_certificate_id UUID REFERENCES public.stock_certificates(id) ON DELETE SET NULL;

-- Phase 3: Create recalculate_ownership_percentages function
CREATE OR REPLACE FUNCTION public.recalculate_ownership_percentages(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_units NUMERIC;
BEGIN
  -- Calculate total units outstanding for this company
  -- Issuance and Transfer-In add units; Transfer-Out, Redemption, Cancellation subtract
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('Issuance', 'Transfer In', 'Capital Contribution', 'Initial Contribution') THEN num_shares
      WHEN transaction_type IN ('Transfer Out', 'Redemption', 'Cancellation', 'Return of Capital') THEN -num_shares
      ELSE 0
    END
  ), 0) INTO total_units
  FROM share_transactions
  WHERE company_id = p_company_id;

  -- Update each shareholder's ownership percentage
  IF total_units > 0 THEN
    UPDATE shareholders s
    SET ownership_percentage = ROUND(
      (
        SELECT COALESCE(SUM(
          CASE 
            WHEN st.transaction_type IN ('Issuance', 'Transfer In', 'Capital Contribution', 'Initial Contribution') THEN st.num_shares
            WHEN st.transaction_type IN ('Transfer Out', 'Redemption', 'Cancellation', 'Return of Capital') THEN -st.num_shares
            ELSE 0
          END
        ), 0)
        FROM share_transactions st
        WHERE st.company_id = p_company_id
          AND st.shareholder_id = s.id
      ) / total_units * 100, 2
    )
    WHERE s.company_id = p_company_id;
  ELSE
    -- No units outstanding, set all to NULL
    UPDATE shareholders
    SET ownership_percentage = NULL
    WHERE company_id = p_company_id;
  END IF;
END;
$$;
