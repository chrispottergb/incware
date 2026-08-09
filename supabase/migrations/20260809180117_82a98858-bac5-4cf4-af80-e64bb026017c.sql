-- 1. Status allowlist on shareholders. Verified: all 96 rows are 'active' (93)
-- or 'inactive' (3); zero NULLs. 'historical' is included up front so the
-- opening-ownership importer does not require a second constraint change.
ALTER TABLE public.shareholders
  ADD CONSTRAINT shareholders_status_check
  CHECK (status IS NULL OR status IN ('active', 'inactive', 'historical'));

-- 2. Exclude treasury holders from the ownership-percentage denominator.
-- Treasury units are issued but not outstanding. Roster, cap table, meeting
-- attendance and OA member schedules already exclude is_treasury holders; this
-- function was the last place that did not. Verified zero treasury holders and
-- zero treasury-linked transactions exist, so no current percentage moves.
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
      WHEN st.transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution', 'opening_balance') THEN st.num_shares
      WHEN st.transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -st.num_shares
      ELSE 0
    END
  ), 0) INTO total_units
  FROM share_transactions st
  LEFT JOIN shareholders sh ON sh.id = st.shareholder_id
  WHERE st.company_id = p_company_id
    AND st.status != 'corrected'
    AND st.effective_date <= CURRENT_DATE
    AND COALESCE(sh.is_treasury, false) = false;

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
    WHERE s.company_id = p_company_id
      AND COALESCE(s.is_treasury, false) = false;

    -- Treasury holders never carry an ownership percentage.
    UPDATE shareholders
    SET ownership_percentage = NULL
    WHERE company_id = p_company_id
      AND is_treasury = true;
  ELSE
    UPDATE shareholders
    SET ownership_percentage = NULL
    WHERE company_id = p_company_id;
  END IF;
END;
$function$;

-- Rollback (additive only):
--   ALTER TABLE public.shareholders DROP CONSTRAINT shareholders_status_check;
--   plus re-apply the previous body of recalculate_ownership_percentages().