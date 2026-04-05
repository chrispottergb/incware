ALTER TABLE public.share_transactions
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;

ALTER TABLE public.meeting_resolutions
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.share_transactions(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';