
-- Shareholders master table (company-level)
CREATE TABLE public.shareholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  ssn_ein TEXT,
  date_added DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shareholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company shareholders" ON public.shareholders FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = shareholders.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company shareholders" ON public.shareholders FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = shareholders.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company shareholders" ON public.shareholders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = shareholders.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company shareholders" ON public.shareholders FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = shareholders.company_id AND companies.user_id = auth.uid()));

CREATE TRIGGER update_shareholders_updated_at BEFORE UPDATE ON public.shareholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stock certificates table
CREATE TABLE public.stock_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shareholder_id UUID REFERENCES public.shareholders(id) ON DELETE SET NULL,
  certificate_number INTEGER NOT NULL,
  share_class TEXT NOT NULL DEFAULT 'Common',
  num_shares INTEGER NOT NULL DEFAULT 0,
  par_value NUMERIC,
  issue_date DATE,
  cancelled_date DATE,
  cancelled_reason TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company certificates" ON public.stock_certificates FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = stock_certificates.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company certificates" ON public.stock_certificates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = stock_certificates.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company certificates" ON public.stock_certificates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = stock_certificates.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company certificates" ON public.stock_certificates FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = stock_certificates.company_id AND companies.user_id = auth.uid()));

CREATE TRIGGER update_stock_certificates_updated_at BEFORE UPDATE ON public.stock_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Share transactions / Stock ledger
CREATE TABLE public.share_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shareholder_id UUID REFERENCES public.shareholders(id) ON DELETE SET NULL,
  certificate_id UUID REFERENCES public.stock_certificates(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL DEFAULT 'issuance',
  share_class TEXT NOT NULL DEFAULT 'Common',
  num_shares INTEGER NOT NULL DEFAULT 0,
  price_per_share NUMERIC,
  total_consideration NUMERIC,
  consideration_type TEXT DEFAULT 'cash',
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_shareholder TEXT,
  to_shareholder TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.share_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company transactions" ON public.share_transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = share_transactions.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company transactions" ON public.share_transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = share_transactions.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company transactions" ON public.share_transactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = share_transactions.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company transactions" ON public.share_transactions FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = share_transactions.company_id AND companies.user_id = auth.uid()));

-- Bills of sale
CREATE TABLE public.bills_of_sale (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shareholder_id UUID REFERENCES public.shareholders(id) ON DELETE SET NULL,
  certificate_id UUID REFERENCES public.stock_certificates(id) ON DELETE SET NULL,
  seller_name TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  num_shares INTEGER NOT NULL DEFAULT 0,
  share_class TEXT NOT NULL DEFAULT 'Common',
  price_per_share NUMERIC,
  total_price NUMERIC,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bills_of_sale ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company bills" ON public.bills_of_sale FOR SELECT
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = bills_of_sale.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company bills" ON public.bills_of_sale FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = bills_of_sale.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company bills" ON public.bills_of_sale FOR UPDATE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = bills_of_sale.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company bills" ON public.bills_of_sale FOR DELETE
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = bills_of_sale.company_id AND companies.user_id = auth.uid()));
