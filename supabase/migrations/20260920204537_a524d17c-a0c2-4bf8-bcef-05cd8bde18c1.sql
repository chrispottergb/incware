ALTER TABLE public.nonprofit_financial_statements
  ADD COLUMN IF NOT EXISTS has_irregular_period boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS board_review_meeting_id uuid NULL REFERENCES public.meetings(id) ON DELETE SET NULL;