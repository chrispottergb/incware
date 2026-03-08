
CREATE TABLE public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  organizer_name text NOT NULL,
  address text,
  address_2 text,
  city text,
  state text,
  zip text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company organizers"
  ON public.organizers
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = organizers.company_id AND companies.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = organizers.company_id AND companies.user_id = auth.uid()));
