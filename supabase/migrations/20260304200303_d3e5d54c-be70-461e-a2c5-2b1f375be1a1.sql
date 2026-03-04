
-- Add new registered agent fields to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS registered_agent_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS registered_agent_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS registered_agent_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS registered_agent_appointed_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS registered_agent_resigned_date date DEFAULT NULL;

-- Create registered agent history table for tracking changes over time
CREATE TABLE public.registered_agent_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  agent_type text,
  address text,
  address_2 text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  appointed_date date,
  resigned_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registered_agent_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company registered agent history"
ON public.registered_agent_history
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = registered_agent_history.company_id AND companies.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM companies WHERE companies.id = registered_agent_history.company_id AND companies.user_id = auth.uid()
));
