
-- 1. Add columns to share_transactions
ALTER TABLE public.share_transactions
  ADD COLUMN IF NOT EXISTS par_value numeric,
  ADD COLUMN IF NOT EXISTS issued_certificate_number integer,
  ADD COLUMN IF NOT EXISTS surrendered_certificate_number integer;

-- 2. Add is_treasury to shareholders
ALTER TABLE public.shareholders
  ADD COLUMN IF NOT EXISTS is_treasury boolean NOT NULL DEFAULT false;

-- 3. Create transaction_assets table
CREATE TABLE public.transaction_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.share_transactions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_assets ENABLE ROW LEVEL SECURITY;

-- RLS policies for transaction_assets
CREATE POLICY "Users can view own company transaction assets"
  ON public.transaction_assets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = transaction_assets.company_id AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own company transaction assets"
  ON public.transaction_assets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = transaction_assets.company_id AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own company transaction assets"
  ON public.transaction_assets FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = transaction_assets.company_id AND companies.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own company transaction assets"
  ON public.transaction_assets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM companies WHERE companies.id = transaction_assets.company_id AND companies.user_id = auth.uid()
  ));
