
-- Company documents metadata table
CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  category text NOT NULL DEFAULT 'Miscellaneous',
  is_pinned boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company documents"
  ON public.company_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = company_documents.company_id AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own company documents"
  ON public.company_documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = company_documents.company_id AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own company documents"
  ON public.company_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = company_documents.company_id AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own company documents"
  ON public.company_documents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = company_documents.company_id AND companies.user_id = auth.uid()
  ));

-- Storage bucket for company documents
INSERT INTO storage.buckets (id, name, public) VALUES ('company-documents', 'company-documents', false);

-- Storage RLS policies
CREATE POLICY "Users can upload company documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view company documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete company documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'company-documents' AND auth.uid() IS NOT NULL);
