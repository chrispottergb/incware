ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS conflict_policy_adopted_date date;

CREATE TABLE public.conflict_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  disclosure_year integer NOT NULL,
  person_name text NOT NULL,
  person_title text,
  person_source text NOT NULL DEFAULT 'director',
  received_date date,
  conflict_disclosed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_conflict_disclosures_company_year ON public.conflict_disclosures (company_id, disclosure_year);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conflict_disclosures TO authenticated;
GRANT ALL ON public.conflict_disclosures TO service_role;

ALTER TABLE public.conflict_disclosures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conflict disclosures"
ON public.conflict_disclosures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = conflict_disclosures.company_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can insert their own conflict disclosures"
ON public.conflict_disclosures FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = conflict_disclosures.company_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can update their own conflict disclosures"
ON public.conflict_disclosures FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = conflict_disclosures.company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = conflict_disclosures.company_id AND c.user_id = auth.uid()));

CREATE POLICY "Users can delete their own conflict disclosures"
ON public.conflict_disclosures FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = conflict_disclosures.company_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_conflict_disclosures_updated_at
BEFORE UPDATE ON public.conflict_disclosures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();