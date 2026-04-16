CREATE OR REPLACE FUNCTION public.extract_company_id_from_path(path text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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

  IF folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    BEGIN
      RETURN folder::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;

  RETURN NULL;
END;
$function$;