
-- 1A. New table: agreements
CREATE TABLE public.agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  agreement_type text NOT NULL,
  agreement_date date,
  agreement_with text,
  agreement_purpose text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting agreements"
ON public.agreements
FOR ALL
USING (EXISTS (
  SELECT 1 FROM meetings m
  JOIN companies c ON c.id = m.company_id
  WHERE m.id = agreements.meeting_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM meetings m
  JOIN companies c ON c.id = m.company_id
  WHERE m.id = agreements.meeting_id AND c.user_id = auth.uid()
));

-- 1B. New table: meeting_loans
CREATE TABLE public.meeting_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  loan_type text,
  loan_rate numeric,
  loan_amount numeric,
  loan_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting loans"
ON public.meeting_loans
FOR ALL
USING (EXISTS (
  SELECT 1 FROM meetings m
  JOIN companies c ON c.id = m.company_id
  WHERE m.id = meeting_loans.meeting_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM meetings m
  JOIN companies c ON c.id = m.company_id
  WHERE m.id = meeting_loans.meeting_id AND c.user_id = auth.uid()
));

-- 1C. Add salary/bonus to meeting_officers
ALTER TABLE public.meeting_officers
  ADD COLUMN IF NOT EXISTS salary numeric,
  ADD COLUMN IF NOT EXISTS bonus numeric;

-- 1D. Add VIN and purchase/lease fields to company_assets
ALTER TABLE public.company_assets
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS purchase_amount numeric,
  ADD COLUMN IF NOT EXISTS lease_date date,
  ADD COLUMN IF NOT EXISTS lease_amount numeric;
