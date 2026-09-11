CREATE TABLE public.retained_earnings_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meeting_id UUID NULL REFERENCES public.meetings(id) ON DELETE SET NULL,
  fiscal_year INTEGER NOT NULL,
  decision TEXT NOT NULL,
  retained_earnings_reported NUMERIC(18,2) NULL,
  reported_by TEXT NULL,
  reported_as_of DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, fiscal_year)
);

CREATE TABLE public.retained_earnings_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resolution_id UUID NOT NULL REFERENCES public.retained_earnings_resolutions(id) ON DELETE CASCADE,
  category TEXT NULL,
  description TEXT NOT NULL,
  estimated_cost NUMERIC(18,2) NULL,
  target_date DATE NULL,
  carried_from_reason_id UUID NULL REFERENCES public.retained_earnings_reasons(id) ON DELETE SET NULL,
  status TEXT NULL,
  status_note TEXT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retained_earnings_resolutions TO authenticated;
GRANT ALL ON public.retained_earnings_resolutions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retained_earnings_reasons TO authenticated;
GRANT ALL ON public.retained_earnings_reasons TO service_role;

ALTER TABLE public.retained_earnings_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retained_earnings_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own retention resolutions"
  ON public.retained_earnings_resolutions
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = retained_earnings_resolutions.company_id AND companies.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = retained_earnings_resolutions.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Owners can manage their own retention reasons"
  ON public.retained_earnings_reasons
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.retained_earnings_resolutions r
    JOIN public.companies c ON c.id = r.company_id
    WHERE r.id = retained_earnings_reasons.resolution_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.retained_earnings_resolutions r
    JOIN public.companies c ON c.id = r.company_id
    WHERE r.id = retained_earnings_reasons.resolution_id AND c.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.update_retained_earnings_resolutions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER retained_earnings_resolutions_updated_at
  BEFORE UPDATE ON public.retained_earnings_resolutions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retained_earnings_resolutions_updated_at();