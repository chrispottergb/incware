-- 1. Drop plaintext bank number columns (verified empty)
DROP FUNCTION IF EXISTS public.block_plaintext_bank_numbers() CASCADE;
DROP FUNCTION IF EXISTS public.migrate_legacy_bank_numbers(text);

ALTER TABLE public.company_banks DROP COLUMN IF EXISTS account_number;
ALTER TABLE public.company_banks DROP COLUMN IF EXISTS routing_number;
ALTER TABLE public.master_firms DROP COLUMN IF EXISTS account_number;
ALTER TABLE public.master_firms DROP COLUMN IF EXISTS routing_number;

CREATE OR REPLACE FUNCTION public.decrypt_company_bank(p_bank_id uuid, p_encryption_key text)
 RETURNS TABLE(account_number text, routing_number text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  owner_id uuid; enc_acct bytea; enc_rt bytea;
BEGIN
  SELECT c.user_id, b.account_number_encrypted, b.routing_number_encrypted
    INTO owner_id, enc_acct, enc_rt
  FROM company_banks b JOIN companies c ON c.id = b.company_id
  WHERE b.id = p_bank_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN enc_acct IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_acct, p_encryption_key) END,
    CASE WHEN enc_rt IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_rt, p_encryption_key) END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_master_firm_bank(p_firm_id uuid, p_encryption_key text)
 RETURNS TABLE(account_number text, routing_number text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  owner_id uuid; enc_acct bytea; enc_rt bytea;
BEGIN
  SELECT user_id, account_number_encrypted, routing_number_encrypted
    INTO owner_id, enc_acct, enc_rt
  FROM master_firms WHERE id = p_firm_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY SELECT
    CASE WHEN enc_acct IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_acct, p_encryption_key) END,
    CASE WHEN enc_rt IS NOT NULL THEN extensions.pgp_sym_decrypt(enc_rt, p_encryption_key) END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_company_bank(p_bank_id uuid, p_account text, p_routing text, p_encryption_key text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE owner_id uuid;
BEGIN
  SELECT c.user_id INTO owner_id
  FROM company_banks b JOIN companies c ON c.id = b.company_id
  WHERE b.id = p_bank_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.encrypt_master_firm_bank(p_firm_id uuid, p_account text, p_routing text, p_encryption_key text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM master_firms WHERE id = p_firm_id;
  IF owner_id IS NULL OR owner_id != auth.uid() THEN
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
$function$;

-- 2. Remove the orphaned legacy plaintext SSN/EIN archive
DROP TABLE IF EXISTS public.shareholders_legacy_ssn_archive;

-- 3. Company-owner check inside the ownership recalculation routine
CREATE OR REPLACE FUNCTION public.recalculate_ownership_percentages(p_company_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  total_units NUMERIC;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM companies WHERE id = p_company_id;
  IF auth.uid() IS NOT NULL AND (v_owner IS NULL OR v_owner <> auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN st.transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution', 'opening_balance') THEN st.num_shares
      WHEN st.transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -st.num_shares
      ELSE 0
    END
  ), 0) INTO total_units
  FROM share_transactions st
  LEFT JOIN shareholders sh ON sh.id = st.shareholder_id
  WHERE st.company_id = p_company_id
    AND st.status != 'corrected'
    AND st.effective_date <= CURRENT_DATE
    AND COALESCE(sh.is_treasury, false) = false;

  IF total_units > 0 THEN
    UPDATE shareholders s
    SET ownership_percentage = ROUND(
      (
        SELECT COALESCE(SUM(units), 0) FROM (
          SELECT CASE 
            WHEN st.transaction_type IN ('Issuance', 'Capital Contribution', 'Initial Contribution', 'initial_issuance', 'initial_contribution', 'opening_balance') THEN st.num_shares
            WHEN st.transaction_type IN ('Redemption', 'Cancellation', 'Return of Capital', 'redemption') THEN -st.num_shares
            ELSE 0
          END AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id = s.id
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
          UNION ALL
          SELECT st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND st.shareholder_id IS DISTINCT FROM s.id
            AND LOWER(TRIM(st.to_shareholder)) IN (
              SELECT LOWER(TRIM(s.name))
              UNION SELECT LOWER(TRIM(h.previous_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
              UNION SELECT LOWER(TRIM(h.new_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
            )
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer In')
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
          UNION ALL
          SELECT -st.num_shares AS units
          FROM share_transactions st
          WHERE st.company_id = p_company_id
            AND LOWER(TRIM(st.from_shareholder)) IN (
              SELECT LOWER(TRIM(s.name))
              UNION SELECT LOWER(TRIM(h.previous_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
              UNION SELECT LOWER(TRIM(h.new_name)) FROM shareholder_name_history h WHERE h.shareholder_id = s.id
            )
            AND st.transaction_type IN ('transfer', 'interest_transfer', 'interest_assignment', 'gift', 'share_exchange', 'dissociation_buyout', 'Transfer Out')
            AND st.status != 'corrected'
            AND st.effective_date <= CURRENT_DATE
        ) sub
      ) / total_units * 100, 2
    )
    WHERE s.company_id = p_company_id
      AND COALESCE(s.is_treasury, false) = false;

    UPDATE shareholders SET ownership_percentage = NULL
    WHERE company_id = p_company_id AND is_treasury = true;
  ELSE
    UPDATE shareholders SET ownership_percentage = NULL WHERE company_id = p_company_id;
  END IF;
END;
$function$;

-- 4. Lock down EXECUTE on all SECURITY DEFINER functions in public
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Re-grant only what signed-in users legitimately need (each enforces its own
-- ownership/role check internally)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_ownership_percentages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amend_ownership_snapshot(uuid, uuid, date, text, text, text, numeric, text, uuid, boolean, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_company_bank(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_master_firm_bank(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_company_ein(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_companies_ein_batch(uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_ssn_ein(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_company_bank(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_company_ein(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.encrypt_shareholder_ssn(uuid, text, text) TO authenticated;