
-- Officers table (one row per company, stores officer names)
CREATE TABLE public.officers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  president TEXT,
  vice_president TEXT,
  secretary TEXT,
  treasurer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.officers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company officers"
  ON public.officers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = officers.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can insert own company officers"
  ON public.officers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = officers.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can update own company officers"
  ON public.officers FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = officers.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can delete own company officers"
  ON public.officers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = officers.company_id AND companies.user_id = auth.uid()));

-- Directors table (multiple directors per company)
CREATE TABLE public.directors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  added_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company directors"
  ON public.directors FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = directors.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can insert own company directors"
  ON public.directors FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = directors.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can update own company directors"
  ON public.directors FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = directors.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can delete own company directors"
  ON public.directors FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = directors.company_id AND companies.user_id = auth.uid()));

-- Company assets table (benefits, vehicles, leases, property)
CREATE TABLE public.company_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('benefit', 'vehicle', 'lease', 'property')),
  description TEXT NOT NULL,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company assets"
  ON public.company_assets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = company_assets.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can insert own company assets"
  ON public.company_assets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = company_assets.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can update own company assets"
  ON public.company_assets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = company_assets.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can delete own company assets"
  ON public.company_assets FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.companies WHERE companies.id = company_assets.company_id AND companies.user_id = auth.uid()));

-- Add additional columns to companies table for fields from the manual
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS corporate_status TEXT DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS verification_date DATE,
  ADD COLUMN IF NOT EXISTS annual_report_year INTEGER,
  ADD COLUMN IF NOT EXISTS seal_type TEXT DEFAULT 'no_seal',
  ADD COLUMN IF NOT EXISTS scheduled_annual_meeting TEXT,
  ADD COLUMN IF NOT EXISTS election_1244 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS second_name_choice TEXT,
  ADD COLUMN IF NOT EXISTS filing_date DATE,
  ADD COLUMN IF NOT EXISTS delayed_effective_filing_date DATE,
  ADD COLUMN IF NOT EXISTS business_purpose TEXT,
  ADD COLUMN IF NOT EXISTS accounting_method TEXT DEFAULT 'cash basis',
  ADD COLUMN IF NOT EXISTS sic_code TEXT,
  ADD COLUMN IF NOT EXISTS first_year_annual_meeting INTEGER,
  ADD COLUMN IF NOT EXISTS initial_directors_count INTEGER,
  ADD COLUMN IF NOT EXISTS max_directors_allowed INTEGER,
  ADD COLUMN IF NOT EXISTS max_vps_allowed INTEGER,
  ADD COLUMN IF NOT EXISTS additional_provisions TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Timestamp trigger for officers
CREATE TRIGGER update_officers_updated_at
  BEFORE UPDATE ON public.officers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Timestamp trigger for directors
CREATE TRIGGER update_directors_updated_at
  BEFORE UPDATE ON public.directors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Timestamp trigger for company_assets
CREATE TRIGGER update_company_assets_updated_at
  BEFORE UPDATE ON public.company_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
