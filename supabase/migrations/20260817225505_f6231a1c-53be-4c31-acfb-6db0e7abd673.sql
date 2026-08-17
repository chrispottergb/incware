REVOKE EXECUTE ON FUNCTION public.decrypt_ssn_ein(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_ssn_ein(uuid, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_ssn_ein(uuid, text) TO service_role;

-- master_firms: ensure a scoped DELETE policy exists (owner-only) and grants are tight
DROP POLICY IF EXISTS "Users can delete own master firms" ON public.master_firms;
CREATE POLICY "Users can delete own master firms"
ON public.master_firms FOR DELETE TO authenticated
USING (auth.uid() = user_id);

REVOKE ALL ON public.master_firms FROM anon;
REVOKE ALL ON public.company_banks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_firms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_banks TO authenticated;
GRANT ALL ON public.master_firms TO service_role;
GRANT ALL ON public.company_banks TO service_role;