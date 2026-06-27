
-- =========================================================
-- A. user_roles privilege-escalation lockdown
-- =========================================================

-- Explicit restrictive policies so only admins can write
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
CREATE POLICY "Only admins can update roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can delete roles"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Defense-in-depth trigger: block self-promotion
CREATE OR REPLACE FUNCTION public.prevent_self_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.user_id = auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Users cannot assign roles to themselves';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_assignment ON public.user_roles;
CREATE TRIGGER trg_prevent_self_role_assignment
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_assignment();

-- =========================================================
-- B. Lock down SECURITY DEFINER function EXECUTE grants
-- =========================================================

-- Internal/admin-only helpers: service_role only
REVOKE ALL ON FUNCTION public.migrate_legacy_company_ein(text)         FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.migrate_legacy_company_ein(text)     TO service_role;

REVOKE ALL ON FUNCTION public.decrypt_company_ein_service(uuid, text)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decrypt_company_ein_service(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) TO service_role, authenticated;

REVOKE ALL ON FUNCTION public.encrypt_ssn_ein(text, text)              FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.encrypt_ssn_ein(text, text)          TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)           TO service_role;

REVOKE ALL ON FUNCTION public.delete_email(text, bigint)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_email(text, bigint)           TO service_role;

REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.log_competitor_pricing_change()          FROM PUBLIC, anon, authenticated;
-- Trigger function; no GRANT needed.

REVOKE ALL ON FUNCTION public.handle_new_user()                        FROM PUBLIC, anon, authenticated;
-- Trigger function; no GRANT needed.

REVOKE ALL ON FUNCTION public.auto_cancel_surrendered_certificate()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column()               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_asset_transaction_type()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_lease_classification_fields()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_role_assignment()           FROM PUBLIC, anon, authenticated;

-- User-callable helpers (still SECURITY DEFINER but ownership-checked inside)
REVOKE ALL ON FUNCTION public.encrypt_company_ein(uuid, text, text)       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.encrypt_company_ein(uuid, text, text)   TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.decrypt_company_ein(uuid, text)             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decrypt_company_ein(uuid, text)         TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.decrypt_ssn_ein(uuid, text)                 FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.decrypt_ssn_ein(uuid, text)             TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role)                    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role)                TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.recalculate_ownership_percentages(uuid)     FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.recalculate_ownership_percentages(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.extract_company_id_from_path(text)          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.extract_company_id_from_path(text)      TO authenticated, service_role;

-- =========================================================
-- B.5  Add SET search_path to functions that are missing it
-- =========================================================

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq, extensions
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq, extensions
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq, extensions
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pgmq, extensions
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

-- Re-lock grants on the recreated functions
REVOKE ALL ON FUNCTION public.enqueue_email(text, jsonb)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)           TO service_role;
REVOKE ALL ON FUNCTION public.delete_email(text, bigint)               FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_email(text, bigint)           TO service_role;
REVOKE ALL ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- =========================================================
-- C. Legacy SSN archive: add admin-only access
-- =========================================================
DROP POLICY IF EXISTS "Admins can view legacy ssn archive" ON public.shareholders_legacy_ssn_archive;
CREATE POLICY "Admins can view legacy ssn archive"
  ON public.shareholders_legacy_ssn_archive
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete legacy ssn archive" ON public.shareholders_legacy_ssn_archive;
CREATE POLICY "Admins can delete legacy ssn archive"
  ON public.shareholders_legacy_ssn_archive
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT, DELETE ON public.shareholders_legacy_ssn_archive TO authenticated;
GRANT ALL ON public.shareholders_legacy_ssn_archive TO service_role;

-- =========================================================
-- D. Resource-images bucket: restrict listing to authenticated
-- =========================================================
DROP POLICY IF EXISTS "Anyone can view resource images" ON storage.objects;
CREATE POLICY "Authenticated can view resource images"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'resource-images');
