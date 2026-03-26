
-- Filing checklist items table
CREATE TABLE public.filing_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ein_number TEXT NULL,
  document_file_name TEXT NULL,
  document_file_path TEXT NULL,
  notes TEXT NULL,
  filed_date DATE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.filing_checklist ENABLE ROW LEVEL SECURITY;

-- RLS: Users can manage their own company filing checklist items
CREATE POLICY "Users can manage own company filing checklist"
ON public.filing_checklist FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = filing_checklist.company_id AND companies.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = filing_checklist.company_id AND companies.user_id = auth.uid()
));

-- Storage bucket for filing documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('filing-documents', 'filing-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload filing documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'filing-documents');

CREATE POLICY "Users can view own filing documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'filing-documents');

CREATE POLICY "Users can delete own filing documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'filing-documents');
