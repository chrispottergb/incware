
-- Add contact email and salutation fields to companies table
ALTER TABLE public.companies
ADD COLUMN contact_email text DEFAULT NULL,
ADD COLUMN salutation_name text DEFAULT NULL;
