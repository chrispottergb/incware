
-- Step 1: Delete duplicate director rows, keeping the one with the earliest created_at per (company_id, name)
DELETE FROM public.directors
WHERE id NOT IN (
  SELECT DISTINCT ON (company_id, lower(name)) id
  FROM public.directors
  ORDER BY company_id, lower(name), created_at ASC
);

-- Step 2: Add unique index to prevent future duplicates
CREATE UNIQUE INDEX idx_directors_company_name_unique ON public.directors (company_id, lower(name));
