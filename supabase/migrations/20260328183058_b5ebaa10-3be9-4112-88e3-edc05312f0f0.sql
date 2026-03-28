
-- Add asset_type and transaction_type to the unified table
ALTER TABLE public.meeting_vehicle_purchases
  ADD COLUMN IF NOT EXISTS asset_type text NOT NULL DEFAULT 'Vehicle',
  ADD COLUMN IF NOT EXISTS transaction_type text NOT NULL DEFAULT 'Purchased';

-- Migrate data from meeting_vehicle_leases into meeting_vehicle_purchases
INSERT INTO public.meeting_vehicle_purchases (meeting_id, year_make_model, vin, purchase_date, purchase_price, seller, business_use_description, notes, asset_type, transaction_type)
SELECT meeting_id, year_make_model, vin, lease_start_date, monthly_lease_payment, lessor_name, business_use_description, notes, 'Vehicle', 'Leased'
FROM public.meeting_vehicle_leases;

-- Migrate data from meeting_vehicle_sales into meeting_vehicle_purchases
INSERT INTO public.meeting_vehicle_purchases (meeting_id, year_make_model, vin, purchase_date, purchase_price, seller, business_use_description, notes, asset_type, transaction_type)
SELECT meeting_id, year_make_model, vin, sale_date, sale_price, buyer_name, business_use_description, notes, 'Vehicle', 'Sold'
FROM public.meeting_vehicle_sales;
