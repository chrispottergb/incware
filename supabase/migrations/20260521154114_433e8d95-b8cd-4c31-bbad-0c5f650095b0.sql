CREATE TABLE public.nonprofit_initial_directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text,
  address text,
  city text,
  state text,
  zip text,
  email text,
  phone text,
  term_length text,
  term_start_date date,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_nonprofit_initial_directors_company ON public.nonprofit_initial_directors(company_id);

ALTER TABLE public.nonprofit_initial_directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company initial directors"
ON public.nonprofit_initial_directors
FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = nonprofit_initial_directors.company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = nonprofit_initial_directors.company_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_nonprofit_initial_directors_updated_at
BEFORE UPDATE ON public.nonprofit_initial_directors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();