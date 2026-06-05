ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS llc_management_structure text,
  ADD COLUMN IF NOT EXISTS llc_authorized_binders jsonb,
  ADD COLUMN IF NOT EXISTS llc_dfi_statement_filed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS llc_dfi_statement_reference text,
  ADD COLUMN IF NOT EXISTS llc_dfi_statement_date date;