ALTER TABLE public.meeting_shareholders
  ADD COLUMN address text DEFAULT NULL,
  ADD COLUMN city text DEFAULT NULL,
  ADD COLUMN state text DEFAULT NULL,
  ADD COLUMN zip text DEFAULT NULL;