
-- Create business_sales table
CREATE TABLE public.business_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_type TEXT NOT NULL,
  statute_reference TEXT,
  buyer_name TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_price NUMERIC,
  consideration_type TEXT NOT NULL DEFAULT 'cash',
  financing_terms TEXT,
  property_description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_sales ENABLE ROW LEVEL SECURITY;

-- RLS policies scoped through companies
CREATE POLICY "Users can view own company business sales"
ON public.business_sales FOR SELECT
USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = business_sales.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can insert own company business sales"
ON public.business_sales FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = business_sales.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can update own company business sales"
ON public.business_sales FOR UPDATE
USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = business_sales.company_id AND companies.user_id = auth.uid()));

CREATE POLICY "Users can delete own company business sales"
ON public.business_sales FOR DELETE
USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = business_sales.company_id AND companies.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_business_sales_updated_at
BEFORE UPDATE ON public.business_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
