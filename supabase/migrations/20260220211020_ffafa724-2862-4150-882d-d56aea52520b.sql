ALTER TABLE company_assets
  ADD COLUMN IF NOT EXISTS landlord_name text,
  ADD COLUMN IF NOT EXISTS landlord_address text,
  ADD COLUMN IF NOT EXISTS lease_start_date date,
  ADD COLUMN IF NOT EXISTS lease_end_date date,
  ADD COLUMN IF NOT EXISTS lease_term text,
  ADD COLUMN IF NOT EXISTS monthly_payment numeric;