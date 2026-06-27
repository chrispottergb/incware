
-- 1. Schema additions
ALTER TABLE public.company_banks
  ADD COLUMN IF NOT EXISTS account_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS routing_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS account_number_last4 text,
  ADD COLUMN IF NOT EXISTS routing_number_last4 text;

ALTER TABLE public.master_firms
  ADD COLUMN IF NOT EXISTS account_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS routing_number_encrypted bytea,
  ADD COLUMN IF NOT EXISTS account_number_last4 text,
  ADD COLUMN IF NOT EXISTS routing_number_last4 text;

-- 2. Encryption/Decryption functions for company_banks
CREATE OR REPLACE FUNCTION public.encrypt_company_bank(
  p_bank_id uuid,
  p_account text,
  p_routing text,
  p_encryption_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT c.user_id INTO owner_id
  FROM company_banks b
  JOIN companies c ON c.id = b.company_id
  WHERE b.id = p_bank_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE company_banks SET
    account_number_encrypted = CASE
      WHEN p_account IS NOT NULL AND p_account <> ''
        THEN extensions.pgp_sym_encrypt(p_account, p_encryption_key)
      ELSE NULL END,
    account_number_last4 = CASE
      WHEN p_account IS NOT NULL AND length(p_account) >= 4
        THEN right(p_account, 4)
      WHEN p_account IS NOT NULL AND p_account <> ''
        THEN p_account
      ELSE NULL END,
    routing_number_encrypted = CASE
      WHEN p_routing IS NOT NULL AND p_routing <> ''
        THEN extensions.pgp_sym_encrypt(p_routing, p_encryption_key)
      ELSE NULL END,
    routing_number_last4 = CASE
      WHEN p_routing IS NOT NULL AND length(p_routing) >= 4
        THEN right(p_routing, 4)
      WHEN p_routing IS NOT NULL AND p_routing <> ''
        THEN p_routing
      ELSE NULL END,
    account_number = NULL,
    routing_number = NULL
  WHERE id = p_bank_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_company_bank(
  p_bank_id uuid,
  p_encryption_key text
) RETURNS TABLE(account_number text, routing_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  enc_acct bytea;
  enc_rt bytea;
  legacy_acct text;
  legacy_rt text;
BEGIN
  SELECT c.user_id, b.account_number_encrypted, b.routing_number_encrypted, b.account_number, b.routing_number
    INTO owner_id, enc_acct, enc_rt, legacy_acct, legacy_rt
  FROM company_banks b
  JOIN companies c ON c.id = b.company_id
  WHERE b.id = p_bank_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN enc_acct IS NOT NULL
      THEN extensions.pgp_sym_decrypt(enc_acct, p_encryption_key)
      ELSE legacy_acct END,
    CASE WHEN enc_rt IS NOT NULL
      THEN extensions.pgp_sym_decrypt(enc_rt, p_encryption_key)
      ELSE legacy_rt END;
END;
$$;

-- 3. Encryption/Decryption functions for master_firms
CREATE OR REPLACE FUNCTION public.encrypt_master_firm_bank(
  p_firm_id uuid,
  p_account text,
  p_routing text,
  p_encryption_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM master_firms WHERE id = p_firm_id;
  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE master_firms SET
    account_number_encrypted = CASE
      WHEN p_account IS NOT NULL AND p_account <> ''
        THEN extensions.pgp_sym_encrypt(p_account, p_encryption_key)
      ELSE NULL END,
    account_number_last4 = CASE
      WHEN p_account IS NOT NULL AND length(p_account) >= 4
        THEN right(p_account, 4)
      WHEN p_account IS NOT NULL AND p_account <> ''
        THEN p_account
      ELSE NULL END,
    routing_number_encrypted = CASE
      WHEN p_routing IS NOT NULL AND p_routing <> ''
        THEN extensions.pgp_sym_encrypt(p_routing, p_encryption_key)
      ELSE NULL END,
    routing_number_last4 = CASE
      WHEN p_routing IS NOT NULL AND length(p_routing) >= 4
        THEN right(p_routing, 4)
      WHEN p_routing IS NOT NULL AND p_routing <> ''
        THEN p_routing
      ELSE NULL END,
    account_number = NULL,
    routing_number = NULL
  WHERE id = p_firm_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_master_firm_bank(
  p_firm_id uuid,
  p_encryption_key text
) RETURNS TABLE(account_number text, routing_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  enc_acct bytea;
  enc_rt bytea;
  legacy_acct text;
  legacy_rt text;
BEGIN
  SELECT user_id, account_number_encrypted, routing_number_encrypted, account_number, routing_number
    INTO owner_id, enc_acct, enc_rt, legacy_acct, legacy_rt
  FROM master_firms WHERE id = p_firm_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN enc_acct IS NOT NULL
      THEN extensions.pgp_sym_decrypt(enc_acct, p_encryption_key)
      ELSE legacy_acct END,
    CASE WHEN enc_rt IS NOT NULL
      THEN extensions.pgp_sym_decrypt(enc_rt, p_encryption_key)
      ELSE legacy_rt END;
END;
$$;

-- 4. Backfill function (callable by service_role from an admin edge function)
CREATE OR REPLACE FUNCTION public.migrate_legacy_bank_numbers(p_encryption_key text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_banks_encrypted int := 0;
  v_firms_encrypted int := 0;
  v_errors jsonb := '[]'::jsonb;
BEGIN
  FOR rec IN
    SELECT id, account_number, routing_number FROM company_banks
    WHERE (account_number IS NOT NULL AND account_number <> '' AND account_number_encrypted IS NULL)
       OR (routing_number IS NOT NULL AND routing_number <> '' AND routing_number_encrypted IS NULL)
  LOOP
    BEGIN
      UPDATE company_banks SET
        account_number_encrypted = CASE WHEN rec.account_number IS NOT NULL AND rec.account_number <> ''
          THEN extensions.pgp_sym_encrypt(rec.account_number, p_encryption_key) ELSE account_number_encrypted END,
        account_number_last4 = CASE WHEN rec.account_number IS NOT NULL AND length(rec.account_number) >= 4
          THEN right(rec.account_number, 4)
          WHEN rec.account_number IS NOT NULL AND rec.account_number <> '' THEN rec.account_number
          ELSE account_number_last4 END,
        routing_number_encrypted = CASE WHEN rec.routing_number IS NOT NULL AND rec.routing_number <> ''
          THEN extensions.pgp_sym_encrypt(rec.routing_number, p_encryption_key) ELSE routing_number_encrypted END,
        routing_number_last4 = CASE WHEN rec.routing_number IS NOT NULL AND length(rec.routing_number) >= 4
          THEN right(rec.routing_number, 4)
          WHEN rec.routing_number IS NOT NULL AND rec.routing_number <> '' THEN rec.routing_number
          ELSE routing_number_last4 END,
        account_number = NULL,
        routing_number = NULL
      WHERE id = rec.id;
      v_banks_encrypted := v_banks_encrypted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('table','company_banks','id',rec.id,'error',SQLERRM));
    END;
  END LOOP;

  FOR rec IN
    SELECT id, account_number, routing_number FROM master_firms
    WHERE (account_number IS NOT NULL AND account_number <> '' AND account_number_encrypted IS NULL)
       OR (routing_number IS NOT NULL AND routing_number <> '' AND routing_number_encrypted IS NULL)
  LOOP
    BEGIN
      UPDATE master_firms SET
        account_number_encrypted = CASE WHEN rec.account_number IS NOT NULL AND rec.account_number <> ''
          THEN extensions.pgp_sym_encrypt(rec.account_number, p_encryption_key) ELSE account_number_encrypted END,
        account_number_last4 = CASE WHEN rec.account_number IS NOT NULL AND length(rec.account_number) >= 4
          THEN right(rec.account_number, 4)
          WHEN rec.account_number IS NOT NULL AND rec.account_number <> '' THEN rec.account_number
          ELSE account_number_last4 END,
        routing_number_encrypted = CASE WHEN rec.routing_number IS NOT NULL AND rec.routing_number <> ''
          THEN extensions.pgp_sym_encrypt(rec.routing_number, p_encryption_key) ELSE routing_number_encrypted END,
        routing_number_last4 = CASE WHEN rec.routing_number IS NOT NULL AND length(rec.routing_number) >= 4
          THEN right(rec.routing_number, 4)
          WHEN rec.routing_number IS NOT NULL AND rec.routing_number <> '' THEN rec.routing_number
          ELSE routing_number_last4 END,
        account_number = NULL,
        routing_number = NULL
      WHERE id = rec.id;
      v_firms_encrypted := v_firms_encrypted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('table','master_firms','id',rec.id,'error',SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'company_banks_encrypted', v_banks_encrypted,
    'master_firms_encrypted', v_firms_encrypted,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrate_legacy_bank_numbers(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.migrate_legacy_bank_numbers(text) TO service_role;

-- 5. Trigger to block direct plaintext writes via PostgREST going forward
CREATE OR REPLACE FUNCTION public.block_plaintext_bank_numbers()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NOT NULL AND NEW.account_number <> '' THEN
    RAISE EXCEPTION 'Direct writes to account_number are not allowed; use the encrypt edge function.';
  END IF;
  IF NEW.routing_number IS NOT NULL AND NEW.routing_number <> '' THEN
    RAISE EXCEPTION 'Direct writes to routing_number are not allowed; use the encrypt edge function.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_plaintext_bank_numbers_company_banks ON public.company_banks;
CREATE TRIGGER trg_block_plaintext_bank_numbers_company_banks
BEFORE INSERT OR UPDATE ON public.company_banks
FOR EACH ROW EXECUTE FUNCTION public.block_plaintext_bank_numbers();

DROP TRIGGER IF EXISTS trg_block_plaintext_bank_numbers_master_firms ON public.master_firms;
CREATE TRIGGER trg_block_plaintext_bank_numbers_master_firms
BEFORE INSERT OR UPDATE ON public.master_firms
FOR EACH ROW EXECUTE FUNCTION public.block_plaintext_bank_numbers();
