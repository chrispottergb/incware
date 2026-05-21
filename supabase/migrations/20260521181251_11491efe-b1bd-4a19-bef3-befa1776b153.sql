
CREATE TABLE IF NOT EXISTS public.nonprofit_tax_exemption (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  electing_501c3 BOOLEAN DEFAULT false,
  form_selection TEXT,
  eligibility_result TEXT,
  eligibility_run_date DATE,
  date_application_submitted DATE,
  filing_fee_amount NUMERIC(12,2),
  filing_fee_date_paid DATE,
  authorized_signatory TEXT,
  method_of_submission TEXT,
  application_status TEXT,
  irs_determination_letter_date DATE,
  effective_date_of_exemption DATE,
  public_charity_classification TEXT,
  determination_letter_path TEXT,
  form_990_version_required TEXT,
  filing_due_date DATE,
  state_registration_required TEXT,
  registration_number TEXT,
  registration_date DATE,
  expiration_date DATE,
  registration_status TEXT,
  annual_renewal_due_date DATE,
  registration_certificate_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nonprofit_tax_exemption ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage tax exemption"
ON public.nonprofit_tax_exemption FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_nonprofit_tax_exemption_updated_at
BEFORE UPDATE ON public.nonprofit_tax_exemption
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE IF NOT EXISTS public.nonprofit_form990_filings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year TEXT,
  form_version TEXT,
  date_filed DATE,
  status TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nonprofit_form990_filings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage form990 filings"
ON public.nonprofit_form990_filings FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_form990_filings_company ON public.nonprofit_form990_filings(company_id);

CREATE TRIGGER trg_nonprofit_form990_filings_updated_at
BEFORE UPDATE ON public.nonprofit_form990_filings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
