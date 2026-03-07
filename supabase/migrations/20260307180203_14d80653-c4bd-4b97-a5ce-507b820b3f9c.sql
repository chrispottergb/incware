
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS charitable_contribution_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS charitable_contribution_org text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vehicle_policy_text text DEFAULT NULL;
