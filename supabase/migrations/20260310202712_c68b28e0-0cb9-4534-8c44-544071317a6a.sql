
ALTER TABLE public.agreements
  ADD COLUMN IF NOT EXISTS amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expiration_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_file_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_file_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_carried_forward boolean NOT NULL DEFAULT false;
