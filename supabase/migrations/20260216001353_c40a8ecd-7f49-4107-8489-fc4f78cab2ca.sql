
-- Document registry table to track all generated documents
CREATE TABLE public.document_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL, -- 'minutes', 'amendment', 'resolution', 'financial', etc.
  document_category TEXT NOT NULL, -- 'meeting_minutes', 'corporate_filing', 'financial_report', etc.
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT, -- URL to stored PDF in cloud storage
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'final', 'filed', 'approved'
  statute_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_registry ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own company documents"
ON public.document_registry FOR SELECT
USING (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = document_registry.company_id AND companies.user_id = auth.uid()
));

CREATE POLICY "Users can insert own company documents"
ON public.document_registry FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = document_registry.company_id AND companies.user_id = auth.uid()
));

CREATE POLICY "Users can update own company documents"
ON public.document_registry FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = document_registry.company_id AND companies.user_id = auth.uid()
));

CREATE POLICY "Users can delete own company documents"
ON public.document_registry FOR DELETE
USING (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = document_registry.company_id AND companies.user_id = auth.uid()
));

-- Timestamp trigger
CREATE TRIGGER update_document_registry_updated_at
BEFORE UPDATE ON public.document_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add document_status to meetings table for tracking
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS document_status TEXT DEFAULT 'draft';

-- Storage bucket for generated documents
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-documents', 'generated-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated documents
CREATE POLICY "Users can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'generated-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'generated-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'generated-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
