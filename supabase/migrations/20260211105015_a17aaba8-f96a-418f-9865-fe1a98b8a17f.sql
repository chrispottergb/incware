
-- Meetings table (core meeting info matching the manual's Meeting Info section)
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  meeting_time TEXT,
  tax_year INTEGER,
  meeting_type TEXT NOT NULL DEFAULT 'Annual Meeting',
  sub_type TEXT,
  meeting_location TEXT,
  chairperson TEXT,
  mtg_secretary TEXT,
  others_present TEXT,
  prior_mtg_date DATE,
  next_annual_mtg DATE,
  -- Company name/address at time of meeting (may differ from current)
  company_name_at_meeting TEXT,
  company_address_at_meeting TEXT,
  company_city_at_meeting TEXT,
  company_state_at_meeting TEXT,
  company_zip_at_meeting TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company meetings"
  ON public.meetings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = meetings.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can insert own company meetings"
  ON public.meetings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = meetings.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can update own company meetings"
  ON public.meetings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = meetings.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can delete own company meetings"
  ON public.meetings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = meetings.company_id AND companies.user_id = auth.uid()));

CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Meeting financials (current year vs previous year comparison)
CREATE TABLE public.meeting_financials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE UNIQUE,
  current_total_sales NUMERIC,
  current_gross_profit NUMERIC,
  current_cog NUMERIC,
  current_cog_ratio NUMERIC,
  current_net_income NUMERIC,
  previous_total_sales NUMERIC,
  previous_gross_profit NUMERIC,
  previous_cog NUMERIC,
  previous_cog_ratio NUMERIC,
  previous_net_income NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meeting financials"
  ON public.meeting_financials FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_financials.meeting_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own meeting financials"
  ON public.meeting_financials FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_financials.meeting_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own meeting financials"
  ON public.meeting_financials FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_financials.meeting_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own meeting financials"
  ON public.meeting_financials FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_financials.meeting_id AND c.user_id = auth.uid()
  ));

CREATE TRIGGER update_meeting_financials_updated_at
  BEFORE UPDATE ON public.meeting_financials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Meeting officers (elected at meeting)
CREATE TABLE public.meeting_officers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting officers"
  ON public.meeting_officers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_officers.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting directors (listed at meeting)
CREATE TABLE public.meeting_directors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  director_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting directors"
  ON public.meeting_directors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_directors.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting shareholders (shareholders at meeting with shares held)
CREATE TABLE public.meeting_shareholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  shareholder_name TEXT NOT NULL,
  common_shares INTEGER DEFAULT 0,
  preferred_shares INTEGER DEFAULT 0,
  distribution TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting shareholders"
  ON public.meeting_shareholders FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_shareholders.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting counsel/banking/loans
CREATE TABLE public.meeting_counsel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  counsel_name TEXT,
  bank_name TEXT,
  loans TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_counsel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting counsel"
  ON public.meeting_counsel FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_counsel.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting assets (benefits, vehicles, leases, property at the meeting)
CREATE TABLE public.meeting_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  description TEXT NOT NULL,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting assets"
  ON public.meeting_assets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_assets.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting amendments
CREATE TABLE public.meeting_amendments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  amendment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting amendments"
  ON public.meeting_amendments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_amendments.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting resolutions (with purpose and resolution text)
CREATE TABLE public.meeting_resolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL,
  resolution_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting resolutions"
  ON public.meeting_resolutions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_resolutions.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting benefits
CREATE TABLE public.meeting_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  benefit_description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting benefits"
  ON public.meeting_benefits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_benefits.meeting_id AND c.user_id = auth.uid()
  ));

-- Meeting other (free-form notes)
CREATE TABLE public.meeting_other (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_other ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting other"
  ON public.meeting_other FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.meetings m
    JOIN public.companies c ON c.id = m.company_id
    WHERE m.id = meeting_other.meeting_id AND c.user_id = auth.uid()
  ));
