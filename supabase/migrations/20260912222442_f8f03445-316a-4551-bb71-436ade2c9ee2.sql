CREATE TABLE public.real_property (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_label text,
  street_address text,
  city text,
  state text,
  zip text,
  county text,
  parcel_id text,
  legal_description text,
  acquisition_date date,
  purchase_price numeric,
  seller_name text,
  titled_in_name_of text,
  deed_type text,
  recorded_date date,
  recording_document_number text,
  is_financed boolean NOT NULL DEFAULT false,
  lender_name text,
  linked_loan_id uuid REFERENCES public.meeting_loans(id) ON DELETE SET NULL,
  property_use text,
  authorized_by_meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  notes text,
  status text NOT NULL DEFAULT 'Held',
  disposition_date date,
  sale_price numeric,
  buyer_name text,
  disposition_doc_number text,
  title_held_by_seller boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.real_property TO authenticated;
GRANT ALL ON public.real_property TO service_role;

ALTER TABLE public.real_property ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own real property"
ON public.real_property
FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = real_property.company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = real_property.company_id AND c.user_id = auth.uid()));

CREATE INDEX idx_real_property_company ON public.real_property(company_id);

CREATE TRIGGER update_real_property_updated_at
BEFORE UPDATE ON public.real_property
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();