
CREATE OR REPLACE FUNCTION public.extract_company_id_from_path(path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  folder text;
  company_uuid text;
BEGIN
  folder := split_part(path, '/', 1);
  IF left(folder, 8) = 'company-' THEN
    company_uuid := substring(folder from 9);
    BEGIN
      RETURN company_uuid::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULL;
END;
$$;
