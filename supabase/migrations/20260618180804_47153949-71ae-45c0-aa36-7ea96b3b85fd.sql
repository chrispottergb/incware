ALTER TABLE public.meeting_financials 
  ADD COLUMN IF NOT EXISTS current_expenses numeric,
  ADD COLUMN IF NOT EXISTS previous_expenses numeric;