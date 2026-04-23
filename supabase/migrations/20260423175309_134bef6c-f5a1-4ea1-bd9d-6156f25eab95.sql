ALTER TABLE public.stock_certificates
ADD COLUMN IF NOT EXISTS ownership_percent_snapshot numeric(7,4);

COMMENT ON COLUMN public.stock_certificates.ownership_percent_snapshot IS 'Ownership % at time of issuance; null = legacy, use live calc.';