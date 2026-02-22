
-- Add accountant, attorney, and law firm fields to meeting_counsel
ALTER TABLE public.meeting_counsel
  ADD COLUMN IF NOT EXISTS accountant_name text,
  ADD COLUMN IF NOT EXISTS attorney_name text,
  ADD COLUMN IF NOT EXISTS law_firm text;
