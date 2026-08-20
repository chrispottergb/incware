REVOKE ALL ON FUNCTION public.decrypt_company_bank(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_master_firm_bank(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_company_bank(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_company_ein(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_ssn_ein(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrypt_company_bank(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_master_firm_bank(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_company_bank(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_company_ein(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_ssn_ein(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_review_reviewer_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.reviewed_by IS NOT NULL
     AND NEW.reviewed_by <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'reviewed_by must be the acting user';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_review_reviewer_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_review_reviewer_identity ON public.annual_review_submissions;
CREATE TRIGGER trg_enforce_review_reviewer_identity
BEFORE INSERT OR UPDATE ON public.annual_review_submissions
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_reviewer_identity();

DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
CREATE POLICY "Service role can insert suppressed emails" ON public.suppressed_emails
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read suppressed emails" ON public.suppressed_emails
  FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;
CREATE POLICY "Service role can insert send log" ON public.email_send_log
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read send log" ON public.email_send_log
  FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can update send log" ON public.email_send_log
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state" ON public.email_send_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
CREATE POLICY "Service role can insert tokens" ON public.email_unsubscribe_tokens
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can read tokens" ON public.email_unsubscribe_tokens
  FOR SELECT TO service_role USING (true);
CREATE POLICY "Service role can mark tokens as used" ON public.email_unsubscribe_tokens
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON public.email_send_log, public.email_send_state,
  public.suppressed_emails, public.email_unsubscribe_tokens FROM anon, authenticated;
GRANT ALL ON public.email_send_log, public.email_send_state,
  public.suppressed_emails, public.email_unsubscribe_tokens TO service_role;