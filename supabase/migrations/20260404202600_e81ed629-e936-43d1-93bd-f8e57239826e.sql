ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS share_class text DEFAULT 'Common';
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS num_shares integer DEFAULT 0;
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS distribution text;
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS basis numeric;
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS additional_capital numeric;
NOTIFY pgrst, 'reload schema';