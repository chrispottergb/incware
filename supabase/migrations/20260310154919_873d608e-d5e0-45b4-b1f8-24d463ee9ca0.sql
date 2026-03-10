ALTER TABLE public.meeting_counsel
  ADD COLUMN loc_enabled boolean DEFAULT false,
  ADD COLUMN loc_amount numeric DEFAULT NULL,
  ADD COLUMN loc_interest_rate numeric DEFAULT NULL;