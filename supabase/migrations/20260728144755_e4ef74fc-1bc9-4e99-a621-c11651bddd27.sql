-- 1. Lock down SECURITY DEFINER / internal functions
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Re-grant only the functions the app legitimately calls as a signed-in user
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_ownership_percentages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extract_company_id_from_path(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_company_bank(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_company_ein(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_master_firm_bank(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_ssn_ein(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_company_bank(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_company_ein(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text) TO authenticated;

-- Backend-only helpers stay available to service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 2. app_settings: no anonymous reads
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.app_settings FROM anon;

-- 3. resource-images: only admins may list objects (public URLs still work)
DROP POLICY IF EXISTS "Authenticated can view resource images" ON storage.objects;
CREATE POLICY "Admins can list resource images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resource-images' AND public.has_role(auth.uid(), 'admin'::app_role));