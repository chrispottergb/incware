
-- Add primary contact fields to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_full_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_cell text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS contact_webpage text;
