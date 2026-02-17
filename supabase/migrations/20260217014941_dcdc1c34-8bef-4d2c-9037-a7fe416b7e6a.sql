
CREATE TABLE public.bank_authorized_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_id uuid NOT NULL REFERENCES public.company_banks(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_authorized_signers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own company bank signers" ON public.bank_authorized_signers FOR ALL USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = bank_authorized_signers.company_id AND companies.user_id = auth.uid()));
