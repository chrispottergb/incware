
-- 1. Make generated-documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'generated-documents';

-- 2. Drop ALL existing policies on storage.objects for these buckets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (
      policyname ILIKE '%generated%'
      OR policyname ILIKE '%company-documents%'
      OR policyname ILIKE '%company_documents%'
      OR policyname ILIKE '%filing%'
      OR policyname ILIKE '%ai-compliance%'
      OR policyname ILIKE '%ai_compliance%'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Helper function to extract company id from storage path like "company-{uuid}/..."
CREATE OR REPLACE FUNCTION public.extract_company_id_from_path(path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  folder text;
  company_uuid text;
BEGIN
  folder := split_part(path, '/', 1);
  IF left(folder, 8) = 'company-' THEN
    company_uuid := substring(folder from 9);
    BEGIN
      RETURN company_uuid::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;

-- 3. generated-documents policies
CREATE POLICY "gen_docs_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "gen_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'generated-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "gen_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'generated-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "gen_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

-- 4. company-documents policies
CREATE POLICY "company_docs_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "company_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "company_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "company_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

-- 5. filing-documents policies
CREATE POLICY "filing_docs_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "filing_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "filing_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "filing_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

-- 6. ai-compliance-docs policies
CREATE POLICY "ai_compliance_docs_select_own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "ai_compliance_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "ai_compliance_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));

CREATE POLICY "ai_compliance_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM public.companies WHERE companies.user_id = auth.uid() AND companies.id = public.extract_company_id_from_path(name)
));
