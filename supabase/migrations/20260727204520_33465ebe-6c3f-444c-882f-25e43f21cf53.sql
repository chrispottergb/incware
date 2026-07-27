ALTER TABLE public.company_assets
  ADD COLUMN address_street text,
  ADD COLUMN address_city text,
  ADD COLUMN address_state text,
  ADD COLUMN address_zip text,
  ADD COLUMN landlord_address_street text,
  ADD COLUMN landlord_address_city text,
  ADD COLUMN landlord_address_state text,
  ADD COLUMN landlord_address_zip text,
  ADD COLUMN tenant_address_street text,
  ADD COLUMN tenant_address_city text,
  ADD COLUMN tenant_address_state text,
  ADD COLUMN tenant_address_zip text,
  ADD COLUMN tenant_address_same_as_property boolean,
  ADD COLUMN leasehold_improvements_status text
    CHECK (leasehold_improvements_status IN ('yes','no'));