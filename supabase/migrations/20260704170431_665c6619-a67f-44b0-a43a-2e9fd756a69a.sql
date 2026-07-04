ALTER TABLE public.document_registry ADD COLUMN IF NOT EXISTS superseded_reason text;
ALTER TABLE public.document_registry ADD COLUMN IF NOT EXISTS superseded_at timestamptz;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_registry TO authenticated;
GRANT ALL ON public.document_registry TO service_role;