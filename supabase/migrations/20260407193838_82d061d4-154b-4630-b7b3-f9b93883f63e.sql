
ALTER TABLE share_transactions ADD COLUMN effective_date date;

UPDATE share_transactions SET effective_date = transaction_date WHERE effective_date IS NULL;

ALTER TABLE share_transactions ALTER COLUMN effective_date SET NOT NULL, ALTER COLUMN effective_date SET DEFAULT CURRENT_DATE;

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
      WHEN transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution') THEN num_shares
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
            WHEN st.transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution') THEN st.num_shares
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
            AND LOWER(TRIM(st.to_shareholder)) = LOWER(TRIM(s.name))
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer In')
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
          
          UNION ALL
          
          SELECT -st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND LOWER(TRIM(st.from_shareholder)) = LOWER(TRIM(s.name))
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
