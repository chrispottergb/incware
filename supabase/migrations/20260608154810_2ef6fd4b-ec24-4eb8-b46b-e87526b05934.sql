CREATE TABLE IF NOT EXISTS public.shareholders_legacy_ssn_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shareholder_id uuid NOT NULL,
  company_id uuid,
  ssn_ein_plaintext text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.shareholders_legacy_ssn_archive FROM PUBLIC;
REVOKE ALL ON public.shareholders_legacy_ssn_archive FROM anon;
REVOKE ALL ON public.shareholders_legacy_ssn_archive FROM authenticated;
GRANT ALL ON public.shareholders_legacy_ssn_archive TO service_role;

ALTER TABLE public.shareholders_legacy_ssn_archive ENABLE ROW LEVEL SECURITY;

INSERT INTO public.shareholders_legacy_ssn_archive (shareholder_id, company_id, ssn_ein_plaintext)
SELECT id, company_id, ssn_ein
FROM public.shareholders
WHERE ssn_ein IS NOT NULL AND ssn_ein <> '';

ALTER TABLE public.shareholders DROP COLUMN IF EXISTS ssn_ein;

DROP FUNCTION IF EXISTS public.migrate_legacy_ssn(text);

CREATE OR REPLACE FUNCTION public.encrypt_shareholder_ssn(
  p_shareholder_id uuid,
  p_ssn_ein text,
  p_encryption_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT c.user_id INTO owner_id
  FROM shareholders s
  JOIN companies c ON c.id = s.company_id
  WHERE s.id = p_shareholder_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ssn_ein IS NOT NULL AND p_ssn_ein != '' THEN
    UPDATE shareholders
    SET ssn_ein_encrypted = extensions.pgp_sym_encrypt(p_ssn_ein, p_encryption_key)
    WHERE id = p_shareholder_id;
  ELSE
    UPDATE shareholders
    SET ssn_ein_encrypted = NULL
    WHERE id = p_shareholder_id;
  END IF;
END;
$$;