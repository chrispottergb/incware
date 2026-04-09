
CREATE OR REPLACE FUNCTION public.migrate_legacy_ssn(p_encryption_key text)
RETURNS jsonb
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
    SELECT id, ssn_ein
    FROM public.shareholders
    WHERE ssn_ein IS NOT NULL AND ssn_ein != ''
  LOOP
    -- Only encrypt values that look like plaintext (digits, dashes, spaces)
    IF rec.ssn_ein ~ '^[\d\-\s]+$' THEN
      BEGIN
        UPDATE public.shareholders
        SET ssn_ein_encrypted = extensions.pgp_sym_encrypt(rec.ssn_ein, p_encryption_key),
            ssn_ein = NULL
        WHERE id = rec.id;
        v_encrypted := v_encrypted + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object('id', rec.id, 'error', SQLERRM));
      END;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('encrypted', v_encrypted, 'skipped', v_skipped, 'errors', v_errors);
END;
$$;
