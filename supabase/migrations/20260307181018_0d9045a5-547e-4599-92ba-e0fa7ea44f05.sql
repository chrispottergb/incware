ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS old_business text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS other_business text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS profit_improvement_plan text DEFAULT NULL;