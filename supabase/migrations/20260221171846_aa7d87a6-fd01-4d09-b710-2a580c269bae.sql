
-- Create trigger to auto-encrypt SSN/EIN on insert/update
-- The trigger uses the SSN_ENCRYPTION_KEY secret set via ALTER DATABASE
-- We'll use a simpler approach: encrypt via the ssn_ein column and store in ssn_ein_encrypted

-- Drop the previous trigger function and recreate with a working approach
DROP FUNCTION IF EXISTS public.encrypt_ssn_ein_trigger() CASCADE;

-- Create a trigger function that encrypts using a hardcoded approach via vault
-- Since we can't access Deno.env from SQL, we'll store the key in a config table
-- Better approach: use the encrypt_ssn_ein function with key passed from edge function

-- Create an edge-function-callable encrypt function
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
  -- Verify caller owns the company
  SELECT c.user_id INTO owner_id
  FROM shareholders s
  JOIN companies c ON c.id = s.company_id
  WHERE s.id = p_shareholder_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_ssn_ein IS NOT NULL AND p_ssn_ein != '' THEN
    UPDATE shareholders
    SET ssn_ein_encrypted = pgp_sym_encrypt(p_ssn_ein, p_encryption_key),
        ssn_ein = NULL
    WHERE id = p_shareholder_id;
  ELSE
    UPDATE shareholders
    SET ssn_ein_encrypted = NULL,
        ssn_ein = NULL
    WHERE id = p_shareholder_id;
  END IF;
END;
$$;
