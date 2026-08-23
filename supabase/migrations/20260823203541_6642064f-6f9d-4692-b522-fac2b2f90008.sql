-- Keep invitations private: admin-only via RLS, no anon exposure.
REVOKE ALL ON public.user_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_invitations TO authenticated;
GRANT ALL ON public.user_invitations TO service_role;

CREATE POLICY "Admins can view invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- SECURITY DEFINER hardening: no implicit PUBLIC/anon execute on definer functions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

-- Re-grant only the definer functions the signed-in app genuinely needs.
-- Each enforces company ownership (auth.uid()) internally.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_ownership_percentages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amend_ownership_snapshot(uuid, uuid, date, text, text, text, numeric, text, uuid, boolean, numeric, jsonb) TO authenticated;