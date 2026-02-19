
-- Add address_2 to companies (main address)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to companies (registered agent address)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS registered_agent_address_2 text;

-- Add address_2 to shareholders
ALTER TABLE public.shareholders ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to directors
ALTER TABLE public.directors ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to company_banks
ALTER TABLE public.company_banks ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to accountant_firms
ALTER TABLE public.accountant_firms ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to attorney_firms
ALTER TABLE public.attorney_firms ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to company_assets
ALTER TABLE public.company_assets ADD COLUMN IF NOT EXISTS address_2 text;

-- Add address_2 to meetings (snapshot of company address at meeting time)
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS company_address_2_at_meeting text;
