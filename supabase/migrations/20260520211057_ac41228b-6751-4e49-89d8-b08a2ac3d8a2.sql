ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS state_filing_number text,
  ADD COLUMN IF NOT EXISTS ntee_code text,
  ADD COLUMN IF NOT EXISTS tax_exempt_purpose text,
  ADD COLUMN IF NOT EXISTS non_distribution_clause text;