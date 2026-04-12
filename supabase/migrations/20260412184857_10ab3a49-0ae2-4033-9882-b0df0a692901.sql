
-- =============================================
-- S1: Fix broken storage bucket policies
-- Drop all broken policies for company-documents, filing-documents, ai-compliance-docs
-- =============================================

-- company-documents
DROP POLICY IF EXISTS "company_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_delete_own" ON storage.objects;

CREATE POLICY "company_docs_select_own" ON storage.objects FOR SELECT
USING (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "company_docs_insert_own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "company_docs_update_own" ON storage.objects FOR UPDATE
USING (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "company_docs_delete_own" ON storage.objects FOR DELETE
USING (bucket_id = 'company-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));

-- filing-documents
DROP POLICY IF EXISTS "filing_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_delete_own" ON storage.objects;

CREATE POLICY "filing_docs_select_own" ON storage.objects FOR SELECT
USING (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "filing_docs_insert_own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "filing_docs_update_own" ON storage.objects FOR UPDATE
USING (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "filing_docs_delete_own" ON storage.objects FOR DELETE
USING (bucket_id = 'filing-documents' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));

-- ai-compliance-docs
DROP POLICY IF EXISTS "ai_compliance_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_delete_own" ON storage.objects;

CREATE POLICY "ai_compliance_docs_select_own" ON storage.objects FOR SELECT
USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "ai_compliance_docs_insert_own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "ai_compliance_docs_update_own" ON storage.objects FOR UPDATE
USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));
CREATE POLICY "ai_compliance_docs_delete_own" ON storage.objects FOR DELETE
USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
  SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
));

-- =============================================
-- S3: Add missing INSERT/UPDATE/DELETE policies to tax_return_jobs
-- =============================================
CREATE POLICY "Users can insert own jobs" ON public.tax_return_jobs
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs" ON public.tax_return_jobs
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs" ON public.tax_return_jobs
FOR DELETE USING (auth.uid() = user_id);
