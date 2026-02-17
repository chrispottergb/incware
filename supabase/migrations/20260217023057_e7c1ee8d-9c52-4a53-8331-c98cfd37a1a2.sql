ALTER TABLE meeting_benefits
  ADD COLUMN IF NOT EXISTS benefit_type text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS agent_administrator text,
  ADD COLUMN IF NOT EXISTS insurance_agency text,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS plan_year integer,
  ADD COLUMN IF NOT EXISTS new_plan_effective_date date,
  ADD COLUMN IF NOT EXISTS retirement_contribution numeric,
  ADD COLUMN IF NOT EXISTS eligibility_comments text;