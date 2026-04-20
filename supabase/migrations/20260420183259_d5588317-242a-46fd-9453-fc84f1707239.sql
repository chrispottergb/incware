-- Add has_preferred_shares column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS has_preferred_shares BOOLEAN DEFAULT FALSE;