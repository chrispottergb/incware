-- These helpers are now callable only by service_role (edge functions). The
-- edge function verifies the JWT and passes the verified user id as
-- p_caller_id; a NULL caller id means a trusted server-side job.

DROP FUNCTION IF EXISTS public.decrypt_company_bank(uuid, text);
CREATE FUNCTION public.decrypt_company_bank(p_bank_id uuid, p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS TABLE(account_number text, routing_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner_id uuid; enc_acct bytea; enc_rt bytea;
BEGIN
  SELECT c.user_id, b.account_number_encrypted, b.routing_number_encrypted
    INTO owner_id, enc_acct, enc_rt
  FROM company_banks b JOIN companies c ON c.id = b.company_id
  WHERE b.id = p_bank_id;

  IF p_caller_id IS NOT NULL AND (owner_id IS NULL OR owner_id <> p_caller_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN enc_acct IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_acct, p_encryption_key) END,
    CASE WHEN enc_rt IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_rt, p_encryption_key) END;
END;
$$;

DROP FUNCTION IF EXISTS public.encrypt_company_bank(uuid, text, text, text);
CREATE FUNCTION public.encrypt_company_bank(p_bank_id uuid, p_account text, p_routing text, p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT c.user_id INTO owner_id
  FROM company_banks b JOIN companies c ON c.id = b.company_id
  WHERE b.id = p_bank_id;

  IF p_caller_id IS NOT NULL AND (owner_id IS NULL OR owner_id <> p_caller_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE company_banks SET
    account_number_encrypted = CASE WHEN p_account IS NOT NULL AND p_account <> ''
      THEN extensions.pgp_sym_encrypt(p_account, p_encryption_key) END,
    account_number_last4 = CASE
      WHEN p_account IS NOT NULL AND length(p_account) >= 4 THEN right(p_account, 4)
      WHEN p_account IS NOT NULL AND p_account <> '' THEN p_account END,
    routing_number_encrypted = CASE WHEN p_routing IS NOT NULL AND p_routing <> ''
      THEN extensions.pgp_sym_encrypt(p_routing, p_encryption_key) END,
    routing_number_last4 = CASE
      WHEN p_routing IS NOT NULL AND length(p_routing) >= 4 THEN right(p_routing, 4)
      WHEN p_routing IS NOT NULL AND p_routing <> '' THEN p_routing END
  WHERE id = p_bank_id;
END;
$$;

DROP FUNCTION IF EXISTS public.decrypt_master_firm_bank(uuid, text);
CREATE FUNCTION public.decrypt_master_firm_bank(p_firm_id uuid, p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS TABLE(account_number text, routing_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner_id uuid; enc_acct bytea; enc_rt bytea;
BEGIN
  SELECT user_id, account_number_encrypted, routing_number_encrypted
    INTO owner_id, enc_acct, enc_rt
  FROM master_firms WHERE id = p_firm_id;

  IF p_caller_id IS NOT NULL AND (owner_id IS NULL OR owner_id <> p_caller_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN enc_acct IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_acct, p_encryption_key) END,
    CASE WHEN enc_rt IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_rt, p_encryption_key) END;
END;
$$;

DROP FUNCTION IF EXISTS public.encrypt_master_firm_bank(uuid, text, text, text);
CREATE FUNCTION public.encrypt_master_firm_bank(p_firm_id uuid, p_account text, p_routing text, p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM master_firms WHERE id = p_firm_id;
  IF p_caller_id IS NOT NULL AND (owner_id IS NULL OR owner_id <> p_caller_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE master_firms SET
    account_number_encrypted = CASE WHEN p_account IS NOT NULL AND p_account <> ''
      THEN extensions.pgp_sym_encrypt(p_account, p_encryption_key) END,
    account_number_last4 = CASE
      WHEN p_account IS NOT NULL AND length(p_account) >= 4 THEN right(p_account, 4)
      WHEN p_account IS NOT NULL AND p_account <> '' THEN p_account END,
    routing_number_encrypted = CASE WHEN p_routing IS NOT NULL AND p_routing <> ''
      THEN extensions.pgp_sym_encrypt(p_routing, p_encryption_key) END,
    routing_number_last4 = CASE
      WHEN p_routing IS NOT NULL AND length(p_routing) >= 4 THEN right(p_routing, 4)
      WHEN p_routing IS NOT NULL AND p_routing <> '' THEN p_routing END
  WHERE id = p_firm_id;
END;
$$;

DROP FUNCTION IF EXISTS public.encrypt_company_ein(uuid, text, text);
CREATE FUNCTION public.encrypt_company_ein(p_company_id uuid, p_ein text, p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM companies WHERE id = p_company_id;
  IF p_caller_id IS NOT NULL AND (owner_id IS NULL OR owner_id <> p_caller_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ein IS NOT NULL AND p_ein <> '' THEN
    UPDATE companies
      SET ein_encrypted = extensions.pgp_sym_encrypt(p_ein, p_encryption_key), ein = NULL
      WHERE id = p_company_id;
  ELSE
    UPDATE companies SET ein_encrypted = NULL, ein = NULL WHERE id = p_company_id;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.decrypt_companies_ein_batch(uuid[], text);
CREATE FUNCTION public.decrypt_companies_ein_batch(p_company_ids uuid[], p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS TABLE(company_id uuid, ein text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    AND (p_caller_id IS NULL OR c.user_id = p_caller_id);
END;
$$;

DROP FUNCTION IF EXISTS public.encrypt_shareholder_ssn(uuid, text, text);
CREATE FUNCTION public.encrypt_shareholder_ssn(p_shareholder_id uuid, p_ssn_ein text, p_encryption_key text, p_caller_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT c.user_id INTO owner_id
  FROM shareholders s JOIN companies c ON c.id = s.company_id
  WHERE s.id = p_shareholder_id;

  IF p_caller_id IS NOT NULL AND (owner_id IS NULL OR owner_id <> p_caller_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ssn_ein IS NOT NULL AND p_ssn_ein <> '' THEN
    UPDATE shareholders
      SET ssn_ein_encrypted = extensions.pgp_sym_encrypt(p_ssn_ein, p_encryption_key)
      WHERE id = p_shareholder_id;
  ELSE
    UPDATE shareholders SET ssn_ein_encrypted = NULL WHERE id = p_shareholder_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.decrypt_company_bank(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_company_bank(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_master_firm_bank(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_company_ein(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrypt_company_bank(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_company_bank(uuid, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_master_firm_bank(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_company_ein(uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text, uuid) TO service_role;