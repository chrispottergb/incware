ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS executed_date date NULL;

CREATE TABLE IF NOT EXISTS public.meeting_signatures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  signer_name  text NOT NULL,
  signer_role  text NULL,
  signer_title text NULL,
  representative_name  text NULL,
  representative_title text NULL,
  signed_on    date NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_signatures_meeting_id_idx
  ON public.meeting_signatures(meeting_id);

CREATE UNIQUE INDEX IF NOT EXISTS meeting_signatures_meeting_sort_idx
  ON public.meeting_signatures(meeting_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_signatures TO authenticated;
GRANT ALL ON public.meeting_signatures TO service_role;

ALTER TABLE public.meeting_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting signatures"
ON public.meeting_signatures
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.meetings m
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.id = meeting_signatures.meeting_id AND c.user_id = auth.uid()
));

CREATE TRIGGER update_meeting_signatures_updated_at
BEFORE UPDATE ON public.meeting_signatures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_meeting_executed_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_meeting_id uuid;
  v_total int;
  v_signed int;
  v_max date;
BEGIN
  v_meeting_id := COALESCE(NEW.meeting_id, OLD.meeting_id);

  SELECT count(*), count(signed_on), max(signed_on)
    INTO v_total, v_signed, v_max
  FROM public.meeting_signatures
  WHERE meeting_id = v_meeting_id;

  IF v_total > 0 AND v_total = v_signed THEN
    UPDATE public.meetings SET executed_date = v_max WHERE id = v_meeting_id;
  ELSE
    UPDATE public.meetings SET executed_date = NULL WHERE id = v_meeting_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_meeting_executed_date
AFTER INSERT OR UPDATE OR DELETE ON public.meeting_signatures
FOR EACH ROW EXECUTE FUNCTION public.sync_meeting_executed_date();