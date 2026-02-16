
ALTER TABLE public.meeting_amendments
ADD COLUMN amendment_type text NOT NULL DEFAULT 'Other';
