
CREATE TABLE public.ai_oversight_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  title text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_oversight_contacts TO authenticated;
GRANT ALL ON public.ai_oversight_contacts TO service_role;

ALTER TABLE public.ai_oversight_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company ai_oversight_contacts"
ON public.ai_oversight_contacts FOR ALL
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ai_oversight_contacts.company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ai_oversight_contacts.company_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_ai_oversight_contacts_updated_at
BEFORE UPDATE ON public.ai_oversight_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_oversight_persons
  ADD COLUMN oversight_role text,
  ADD COLUMN effective_date date,
  ADD COLUMN notes text,
  ADD COLUMN source_type text,
  ADD COLUMN source_id uuid,
  ADD COLUMN contact_id uuid REFERENCES public.ai_oversight_contacts(id) ON DELETE SET NULL;
