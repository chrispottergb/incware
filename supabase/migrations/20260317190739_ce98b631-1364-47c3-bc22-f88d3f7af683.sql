
ALTER TABLE public.meeting_loans
ADD COLUMN balance_to_shareholder numeric DEFAULT NULL,
ADD COLUMN balance_from_shareholder numeric DEFAULT NULL;
