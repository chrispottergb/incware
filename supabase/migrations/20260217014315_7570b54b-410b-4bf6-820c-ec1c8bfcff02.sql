
-- Attorney Firms
CREATE TABLE public.attorney_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  firm_name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attorney_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own company attorney firms" ON public.attorney_firms FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = attorney_firms.company_id AND companies.user_id = auth.uid()));
CREATE TRIGGER update_attorney_firms_updated_at BEFORE UPDATE ON public.attorney_firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attorneys
CREATE TABLE public.attorneys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  firm_id uuid REFERENCES public.attorney_firms(id) ON DELETE SET NULL,
  attorney_name text NOT NULL,
  title text,
  bar_number text,
  specialty text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attorneys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own company attorneys" ON public.attorneys FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = attorneys.company_id AND companies.user_id = auth.uid()));
CREATE TRIGGER update_attorneys_updated_at BEFORE UPDATE ON public.attorneys FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Accountant Firms
CREATE TABLE public.accountant_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  firm_name text NOT NULL,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  website text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accountant_firms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own company accountant firms" ON public.accountant_firms FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = accountant_firms.company_id AND companies.user_id = auth.uid()));
CREATE TRIGGER update_accountant_firms_updated_at BEFORE UPDATE ON public.accountant_firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Accountants
CREATE TABLE public.accountants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  firm_id uuid REFERENCES public.accountant_firms(id) ON DELETE SET NULL,
  accountant_name text NOT NULL,
  title text,
  cpa_number text,
  specialty text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accountants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own company accountants" ON public.accountants FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = accountants.company_id AND companies.user_id = auth.uid()));
CREATE TRIGGER update_accountants_updated_at BEFORE UPDATE ON public.accountants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Company Banks
CREATE TABLE public.company_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_type text DEFAULT 'checking',
  account_number text,
  routing_number text,
  contact_name text,
  contact_title text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_banks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own company banks" ON public.company_banks FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = company_banks.company_id AND companies.user_id = auth.uid()));
CREATE TRIGGER update_company_banks_updated_at BEFORE UPDATE ON public.company_banks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
