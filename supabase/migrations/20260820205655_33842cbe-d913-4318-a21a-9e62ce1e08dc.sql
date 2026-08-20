ALTER TABLE public.user_address_book
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.name_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('rename','hide','delete')),
  target_table text NOT NULL,
  target_column text NOT NULL,
  old_value text,
  new_value text,
  row_snapshot jsonb,
  affected_row_count integer NOT NULL DEFAULT 0,
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL DEFAULT auth.uid()
);

GRANT SELECT, INSERT ON public.name_cleanup_log TO authenticated;
GRANT ALL ON public.name_cleanup_log TO service_role;

ALTER TABLE public.name_cleanup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own cleanup log rows"
  ON public.name_cleanup_log FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

CREATE POLICY "Users can view their own cleanup log rows"
  ON public.name_cleanup_log FOR SELECT TO authenticated
  USING (performed_by = auth.uid());

CREATE INDEX IF NOT EXISTS name_cleanup_log_performed_by_at_idx
  ON public.name_cleanup_log (performed_by, performed_at DESC);