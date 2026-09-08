ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS engagement_letter_on_file date;
ALTER TABLE public.master_firms ADD COLUMN IF NOT EXISTS default_fee_terms text;