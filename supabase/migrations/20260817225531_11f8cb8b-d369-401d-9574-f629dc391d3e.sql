REVOKE EXECUTE ON FUNCTION public.decrypt_company_ein(uuid, text) FROM authenticated, anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_company_ein(uuid, text) TO service_role;