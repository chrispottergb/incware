ALTER TABLE public.shareholders ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.shareholders ALTER COLUMN status SET NOT NULL;