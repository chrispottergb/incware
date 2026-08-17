CREATE TABLE IF NOT EXISTS public.interim_actions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action_date      date NULL,
  description      text NOT NULL,
  category         text NULL,
  amount           numeric NULL,
  is_related_party boolean NOT NULL DEFAULT false,
  source_table     text NULL,
  source_id        uuid NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interim_actions_company_id_idx
  ON public.interim_actions(company_id);

CREATE UNIQUE INDEX IF NOT EXISTS interim_actions_source_uniq
  ON public.interim_actions(company_id, source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interim_actions TO authenticated;
GRANT ALL ON public.interim_actions TO service_role;

ALTER TABLE public.interim_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own interim actions"
ON public.interim_actions
FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = interim_actions.company_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_interim_actions_updated_at
BEFORE UPDATE ON public.interim_actions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.meeting_ratifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id        uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  interim_action_id uuid NOT NULL REFERENCES public.interim_actions(id) ON DELETE CASCADE,
  disposition       text NOT NULL DEFAULT 'ratified',
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, interim_action_id)
);

CREATE INDEX IF NOT EXISTS meeting_ratifications_meeting_id_idx
  ON public.meeting_ratifications(meeting_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_ratifications TO authenticated;
GRANT ALL ON public.meeting_ratifications TO service_role;

ALTER TABLE public.meeting_ratifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting ratifications"
ON public.meeting_ratifications
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.meetings m
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.id = meeting_ratifications.meeting_id AND c.user_id = auth.uid()
));

CREATE TRIGGER update_meeting_ratifications_updated_at
BEFORE UPDATE ON public.meeting_ratifications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();