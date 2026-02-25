
CREATE OR REPLACE FUNCTION public.recalculate_ownership_percentages(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_units NUMERIC;
BEGIN
  -- Calculate total units outstanding: only issuances add units, redemptions/cancellations remove them
  -- Transfers just move units between shareholders, they don't change the total
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution') THEN num_shares
      WHEN transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -num_shares
      ELSE 0
    END
  ), 0) INTO total_units
  FROM share_transactions
  WHERE company_id = p_company_id;

  IF total_units > 0 THEN
    UPDATE shareholders s
    SET ownership_percentage = ROUND(
      (
        SELECT COALESCE(SUM(units), 0) FROM (
          -- Units via shareholder_id link (direct entries like issuances)
          SELECT CASE 
            WHEN st.transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution') THEN st.num_shares
            WHEN st.transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -st.num_shares
            ELSE 0
          END AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id = s.id
          
          UNION ALL
          
          -- Units received as buyer in transfers (matched by name)
          SELECT st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id IS DISTINCT FROM s.id
            AND LOWER(TRIM(st.to_shareholder)) = LOWER(TRIM(s.name))
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer In')
          
          UNION ALL
          
          -- Units lost as seller in transfers (matched by name)
          SELECT -st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND LOWER(TRIM(st.from_shareholder)) = LOWER(TRIM(s.name))
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer Out')
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
