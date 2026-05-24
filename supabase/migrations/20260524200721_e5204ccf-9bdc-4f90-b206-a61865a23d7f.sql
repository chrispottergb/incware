ALTER TABLE public.nonprofit_initial_directors
  ADD COLUMN IF NOT EXISTS hours_per_week text;

ALTER TABLE public.nonprofit_tax_exemption
  ADD COLUMN IF NOT EXISTS filing_status text,
  ADD COLUMN IF NOT EXISTS determination_letter_date date;