
CREATE OR REPLACE FUNCTION public.decrypt_company_ein_service(
  p_company_id uuid,
  p_encryption_key text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enc bytea;
  plain text;
BEGIN
  SELECT ein_encrypted, ein INTO enc, plain
  FROM companies WHERE id = p_company_id;
  IF enc IS NOT NULL THEN
    RETURN extensions.pgp_sym_decrypt(enc, p_encryption_key);
  END IF;
  RETURN plain;
END;
$$;

REVOKE ALL ON FUNCTION public.decrypt_company_ein_service(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrypt_company_ein_service(uuid, text) TO service_role;
