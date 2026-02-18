
-- Add new fields to meeting_shareholders for ownership tracking
ALTER TABLE public.meeting_shareholders
  ADD COLUMN IF NOT EXISTS distribution_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS basis numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS additional_capital_contribution numeric DEFAULT NULL;

-- Add enhanced loan fields for promissory notes and direction tracking
ALTER TABLE public.meeting_loans
  ADD COLUMN IF NOT EXISTS loan_direction text DEFAULT 'from_company',
  ADD COLUMN IF NOT EXISTS lender_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS borrower_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS loan_duration text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repayment_terms text DEFAULT NULL;

-- Add "Written Consent" as a valid meeting type option (no constraint needed, it's text)
-- Meeting location already exists as meeting_location column
