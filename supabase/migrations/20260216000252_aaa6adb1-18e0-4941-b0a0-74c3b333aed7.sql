
ALTER TABLE public.company_assets
ADD COLUMN year text,
ADD COLUMN make text,
ADD COLUMN model text,
ADD COLUMN cost numeric,
ADD COLUMN ownership_type text DEFAULT 'owned',
ADD COLUMN running_hours numeric,
ADD COLUMN manufacturer text,
ADD COLUMN address text,
ADD COLUMN finance_company text,
ADD COLUMN escrow numeric,
ADD COLUMN mortgage numeric,
ADD COLUMN taxes numeric;
