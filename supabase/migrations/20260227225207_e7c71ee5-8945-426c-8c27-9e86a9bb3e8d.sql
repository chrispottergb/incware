
-- Add capital account balance to shareholders for LLC tracking
ALTER TABLE public.shareholders
ADD COLUMN IF NOT EXISTS capital_account_balance numeric DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.shareholders.capital_account_balance IS 'Running capital account balance for LLC members (contributions - distributions ± allocated income/loss)';
