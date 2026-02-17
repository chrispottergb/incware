
-- Step 1: Add date tracking columns to bank_authorized_signers
ALTER TABLE public.bank_authorized_signers 
ADD COLUMN effective_date date DEFAULT CURRENT_DATE,
ADD COLUMN end_date date;

-- Backfill existing records: set effective_date from created_at
UPDATE public.bank_authorized_signers 
SET effective_date = created_at::date 
WHERE effective_date IS NULL;

-- Step 2: Create meeting_authorized_signers snapshot table
CREATE TABLE public.meeting_authorized_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES public.bank_authorized_signers(id) ON DELETE SET NULL,
  signer_name text NOT NULL,
  title text,
  bank_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_authorized_signers ENABLE ROW LEVEL SECURITY;

-- RLS policy following existing meeting sub-table pattern
CREATE POLICY "Users can manage own meeting authorized signers"
ON public.meeting_authorized_signers
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_authorized_signers.meeting_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_authorized_signers.meeting_id
    AND c.user_id = auth.uid()
  )
);
