
-- Add dismissal flag for the Authorized Units backfill banner
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS authorized_units_backfill_dismissed boolean NOT NULL DEFAULT false;

-- One-time backfill: for LLC-family entities with a null authorized_shares
-- and at least one issuance, set authorized_shares to the current issued total.
-- Uses the same issuance/reduction arithmetic as recalculate_ownership_percentages().
WITH issued AS (
  SELECT c.id AS company_id,
         COALESCE(SUM(
           CASE
             WHEN st.transaction_type IN (
               'Issuance','initial_issuance','authorized_issuance','subscription_issuance',
               'consideration_issuance','share_dividend','fractional_shares','preemptive_rights',
               'treasury_reissue','Reissuance','reissuance',
               'Capital Contribution','Initial Contribution','initial_contribution',
               'additional_contribution','membership_issuance','opening_balance'
             ) THEN st.num_shares
             WHEN st.transaction_type IN (
               'Redemption','redemption','Cancellation','cancellation','Return of Capital',
               'reacquisition','treasury_acquisition','withdrawal_distribution','dissociation_buyout'
             ) THEN -st.num_shares
             ELSE 0
           END
         ), 0) AS total
    FROM public.companies c
    LEFT JOIN public.share_transactions st
      ON st.company_id = c.id
     AND (st.status IS NULL OR st.status <> 'corrected')
   WHERE c.entity_type IN ('LLC','Single Member LLC','LLC-S')
     AND c.authorized_shares IS NULL
   GROUP BY c.id
)
UPDATE public.companies c
   SET authorized_shares = issued.total::int,
       authorized_units_backfill_dismissed = false
  FROM issued
 WHERE c.id = issued.company_id
   AND issued.total > 0;
