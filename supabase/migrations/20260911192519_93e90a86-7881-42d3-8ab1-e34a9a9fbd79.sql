ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS s_revocation_date date;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_s_revocation_date_valid
  CHECK (s_revocation_date IS NULL OR (s_election_date IS NOT NULL AND s_revocation_date > s_election_date));