
-- Manual timeline events table
CREATE TABLE public.timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company timeline events" ON public.timeline_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = timeline_events.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company timeline events" ON public.timeline_events FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = timeline_events.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company timeline events" ON public.timeline_events FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = timeline_events.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company timeline events" ON public.timeline_events FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = timeline_events.company_id AND companies.user_id = auth.uid()));
