ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS balance_to_shareholder numeric DEFAULT NULL;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS balance_from_shareholder numeric DEFAULT NULL;