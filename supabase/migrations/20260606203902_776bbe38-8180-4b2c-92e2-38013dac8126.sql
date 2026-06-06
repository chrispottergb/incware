
-- 1) Column
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ein_encrypted bytea;

-- 2) Encrypt EIN for a company (owner-only)
CREATE OR REPLACE FUNCTION public.encrypt_company_ein(
  p_company_id uuid,
  p_ein text,
  p_encryption_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM companies WHERE id = p_company_id;
  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ein IS NOT NULL AND p_ein <> '' THEN
    UPDATE companies
      SET ein_encrypted = extensions.pgp_sym_encrypt(p_ein, p_encryption_key),
          ein = NULL
      WHERE id = p_company_id;
  ELSE
    UPDATE companies
      SET ein_encrypted = NULL,
          ein = NULL
      WHERE id = p_company_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.encrypt_company_ein(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_company_ein(uuid, text, text) TO authenticated, service_role;

-- 3) Decrypt EIN for a single company (owner-only)
CREATE OR REPLACE FUNCTION public.decrypt_company_ein(
  p_company_id uuid,
  p_encryption_key text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  enc bytea;
  plain text;
BEGIN
  SELECT user_id, ein_encrypted, ein INTO owner_id, enc, plain
    FROM companies WHERE id = p_company_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF enc IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(enc, p_encryption_key);
  END IF;
  RETURN plain; -- fallback for unmigrated rows
END;
$$;

REVOKE ALL ON FUNCTION public.decrypt_company_ein(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_company_ein(uuid, text) TO authenticated, service_role;

-- 4) Batch decrypt EIN — returns one row per owned company
CREATE OR REPLACE FUNCTION public.decrypt_companies_ein_batch(
  p_company_ids uuid[],
  p_encryption_key text
) RETURNS TABLE(company_id uuid, ein text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id,
         CASE
           WHEN c.ein_encrypted IS NOT NULL
             THEN extensions.pgp_sym_decrypt(c.ein_encrypted, p_encryption_key)
           ELSE c.ein
         END
  FROM companies c
  WHERE c.id = ANY(p_company_ids)
    AND c.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) TO authenticated, service_role;

-- 5) One-time migration of legacy plaintext EIN values (service role only)
CREATE OR REPLACE FUNCTION public.migrate_legacy_company_ein(
  p_encryption_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_encrypted int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  FOR rec IN
    SELECT id, ein
    FROM companies
    WHERE ein IS NOT NULL AND ein <> '' AND ein_encrypted IS NULL
  LOOP
    BEGIN
      UPDATE companies
        SET ein_encrypted = extensions.pgp_sym_encrypt(rec.ein, p_encryption_key),
            ein = NULL
        WHERE id = rec.id;
      v_encrypted := v_encrypted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(
        jsonb_build_object('id', rec.id, 'error', SQLERRM)
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'encrypted', v_encrypted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_legacy_company_ein(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migrate_legacy_company_ein(text) TO service_role;
