
-- Drop all 16 broken company-path policies (SELECT, INSERT, UPDATE, DELETE x 4 buckets)
DROP POLICY IF EXISTS "company_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "filing_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "ai_compliance_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "gen_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "gen_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "gen_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "gen_docs_delete_own" ON storage.objects;

-- Also drop the older duplicate policies for generated-documents and tax-returns
DROP POLICY IF EXISTS "Users can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- ============================================================
-- COMPANY-DOCUMENTS bucket
-- ============================================================
CREATE POLICY "company_docs_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "company_docs_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "company_docs_update_own" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "company_docs_delete_own" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

-- ============================================================
-- FILING-DOCUMENTS bucket
-- ============================================================
CREATE POLICY "filing_docs_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'filing-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "filing_docs_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'filing-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "filing_docs_update_own" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'filing-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "filing_docs_delete_own" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'filing-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

-- ============================================================
-- AI-COMPLIANCE-DOCS bucket
-- ============================================================
CREATE POLICY "ai_compliance_docs_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-compliance-docs'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "ai_compliance_docs_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-compliance-docs'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "ai_compliance_docs_update_own" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ai-compliance-docs'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "ai_compliance_docs_delete_own" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-compliance-docs'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

-- ============================================================
-- GENERATED-DOCUMENTS bucket
-- ============================================================
CREATE POLICY "gen_docs_select_own" ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "gen_docs_insert_own" ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "gen_docs_update_own" ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);

CREATE POLICY "gen_docs_delete_own" ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-documents'
  AND EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = public.extract_company_id_from_path(objects.name)
  )
);
