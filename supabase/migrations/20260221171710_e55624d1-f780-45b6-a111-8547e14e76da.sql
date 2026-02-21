
-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted column to shareholders table
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS ssn_ein_encrypted bytea;

-- Create function to encrypt SSN/EIN data
CREATE OR REPLACE FUNCTION public.encrypt_ssn_ein(plain_text text, encryption_key text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF plain_text IS NULL OR plain_text = '' THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_encrypt(plain_text, encryption_key);
END;
$$;

-- Create function to decrypt SSN/EIN data (only for authorized users via RLS check)
CREATE OR REPLACE FUNCTION public.decrypt_ssn_ein(shareholder_id uuid, encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  encrypted_val bytea;
  owner_id uuid;
BEGIN
  -- Check that the caller owns the company this shareholder belongs to
  SELECT c.user_id INTO owner_id
  FROM shareholders s
  JOIN companies c ON c.id = s.company_id
  WHERE s.id = shareholder_id;

  IF owner_id IS NULL OR owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT ssn_ein_encrypted INTO encrypted_val
  FROM shareholders
  WHERE id = shareholder_id;

  IF encrypted_val IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN pgp_sym_decrypt(encrypted_val, encryption_key);
END;
$$;

-- Create trigger function to auto-encrypt on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_ssn_ein_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  enc_key text;
BEGIN
  -- Get the encryption key from Supabase secrets
  enc_key := current_setting('app.settings.ssn_encryption_key', true);
  
  IF NEW.ssn_ein IS NOT NULL AND NEW.ssn_ein != '' THEN
    NEW.ssn_ein_encrypted := pgp_sym_encrypt(NEW.ssn_ein, enc_key);
    -- Clear the plaintext column
    NEW.ssn_ein := NULL;
  ELSIF NEW.ssn_ein = '' THEN
    NEW.ssn_ein_encrypted := NULL;
    NEW.ssn_ein := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;
