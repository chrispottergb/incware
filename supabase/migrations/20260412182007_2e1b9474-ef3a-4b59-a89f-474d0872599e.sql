
-- Fix broken storage policies: change extract_company_id_from_path(companies.name) to extract_company_id_from_path(name)
-- "name" refers to storage.objects.name (the file path), NOT companies.name

-- Drop broken company-documents policies
DROP POLICY IF EXISTS "company_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "company_docs_delete_own" ON storage.objects;

-- Drop broken filing-documents policies
DROP POLICY IF EXISTS "filing_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "filing_docs_delete_own" ON storage.objects;

-- Drop broken generated-documents policies
DROP POLICY IF EXISTS "gen_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "gen_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "gen_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "gen_docs_delete_own" ON storage.objects;

-- Drop broken ai-compliance-docs policies (both old and new style)
DROP POLICY IF EXISTS "ai_compliance_docs_select_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_update_own" ON storage.objects;
DROP POLICY IF EXISTS "ai_compliance_docs_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own company ai docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own company ai docs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own company ai docs" ON storage.objects;

-- Recreate company-documents policies (fixed: name refers to storage.objects.name)
CREATE POLICY "company_docs_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "company_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "company_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "company_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

-- Recreate filing-documents policies
CREATE POLICY "filing_docs_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'filing-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "filing_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'filing-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "filing_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'filing-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "filing_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'filing-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

-- Recreate generated-documents policies
CREATE POLICY "gen_docs_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generated-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "gen_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "gen_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'generated-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "gen_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'generated-documents' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

-- Recreate ai-compliance-docs policies
CREATE POLICY "ai_compliance_docs_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "ai_compliance_docs_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-compliance-docs' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "ai_compliance_docs_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));

CREATE POLICY "ai_compliance_docs_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-compliance-docs' AND EXISTS (
    SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND companies.id = extract_company_id_from_path(name)
  ));
