ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS preferred_class_name TEXT DEFAULT 'Class B';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS preferred_authorized_shares INTEGER;