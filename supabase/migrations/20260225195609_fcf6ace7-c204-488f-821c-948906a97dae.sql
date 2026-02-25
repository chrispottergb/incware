
CREATE OR REPLACE FUNCTION public.recalculate_ownership_percentages(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_units NUMERIC;
BEGIN
  -- Calculate total units outstanding for this company
  -- For each transaction, determine net units by looking at:
  -- 1. shareholder_id-based matching (legacy direct entries)
  -- 2. to_shareholder name matching (buyer receives units)
  -- We sum all "inbound" units across all shareholders
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('Issuance', 'Transfer In', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution') THEN num_shares
      WHEN transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout') THEN num_shares
      WHEN transaction_type IN ('Transfer Out', 'Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN 0
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
        SELECT COALESCE(SUM(units), 0) FROM (
          -- Units received via shareholder_id link (direct entries like issuances)
          SELECT CASE 
            WHEN st.transaction_type IN ('Issuance', 'Transfer In', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution') THEN st.num_shares
            WHEN st.transaction_type IN ('Transfer Out', 'Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -st.num_shares
            ELSE 0
          END AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id = s.id
          
          UNION ALL
          
          -- Units received as buyer (to_shareholder matches name) for transfer types
          SELECT st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id IS DISTINCT FROM s.id
            AND LOWER(TRIM(st.to_shareholder)) = LOWER(TRIM(s.name))
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout')
          
          UNION ALL
          
          -- Units lost as seller (from_shareholder matches name) for transfer types
          SELECT -st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND LOWER(TRIM(st.from_shareholder)) = LOWER(TRIM(s.name))
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout')
        ) sub
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
$function$;
