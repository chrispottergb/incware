CREATE OR REPLACE FUNCTION public.log_record_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_old_red jsonb;
  v_new_red jsonb;
  v_fields text[];
  v_company uuid;
  v_owner uuid;
  v_record uuid;
  v_actor uuid;
  v_redact text[] := ARRAY['ein','ein_encrypted','ssn_ein_encrypted'];
  k text;
BEGIN
  BEGIN
    v_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

    IF TG_OP = 'UPDATE' THEN
      IF OLD IS NOT DISTINCT FROM NEW THEN
        RETURN NULL;
      END IF;

      -- changed_fields computed from UNREDACTED payloads, by value
      SELECT array_agg(f ORDER BY f) INTO v_fields
      FROM (
        SELECT o.key AS f FROM jsonb_each(v_old) o
        WHERE (v_new -> o.key) IS DISTINCT FROM o.value
        UNION
        SELECT n.key AS f FROM jsonb_each(v_new) n
        WHERE (v_old -> n.key) IS DISTINCT FROM n.value
      ) d;

      IF v_fields IS NULL OR array_length(v_fields, 1) IS NULL THEN
        RETURN NULL;
      END IF;

      IF v_fields = ARRAY['ownership_percentage']::text[] THEN
        RETURN NULL;
      END IF;
    END IF;

    v_old_red := v_old;
    v_new_red := v_new;
    FOREACH k IN ARRAY v_redact LOOP
      IF v_old_red IS NOT NULL THEN v_old_red := v_old_red - k; END IF;
      IF v_new_red IS NOT NULL THEN v_new_red := v_new_red - k; END IF;
    END LOOP;

    IF TG_TABLE_NAME = 'companies' THEN
      v_company := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
      v_owner := coalesce((v_new ->> 'user_id')::uuid, (v_old ->> 'user_id')::uuid);
    ELSE
      v_company := coalesce((v_new ->> 'company_id')::uuid, (v_old ->> 'company_id')::uuid);
      SELECT c.user_id INTO v_owner FROM public.companies c WHERE c.id = v_company;
    END IF;

    v_record := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
    v_actor := coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);

    INSERT INTO public.record_audit (
      table_name, record_id, company_id, owner_user_id, operation,
      changed_by, changed_fields, old_values, new_values
    ) VALUES (
      TG_TABLE_NAME, v_record, v_company, v_owner, TG_OP,
      v_actor, v_fields, v_old_red, v_new_red
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.log_record_audit() FROM PUBLIC, anon, authenticated;