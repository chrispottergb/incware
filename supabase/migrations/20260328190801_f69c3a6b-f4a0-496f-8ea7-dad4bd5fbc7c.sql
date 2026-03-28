ALTER TABLE public.meeting_vehicle_leases 
  ADD COLUMN IF NOT EXISTS asset_type text NOT NULL DEFAULT 'Vehicle',
  ADD COLUMN IF NOT EXISTS lease_end_date date,
  ADD COLUMN IF NOT EXISTS total_lease_value numeric;