ALTER TABLE public.meeting_loans
  ADD COLUMN promissory_note_required boolean DEFAULT false,
  ADD COLUMN promissory_note_file_url text DEFAULT NULL,
  ADD COLUMN promissory_note_file_name text DEFAULT NULL;