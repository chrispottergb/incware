
-- Master firms directory (user-scoped, not company-scoped)
CREATE TABLE public.master_firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  firm_name text NOT NULL,
  firm_type text NOT NULL DEFAULT 'law', -- 'law', 'accounting', 'bank'
  address text,
  address_2 text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  website text,
  account_number text,       -- for banks
  routing_number text,       -- for banks
  account_type text,         -- for banks
  contact_name text,         -- for banks
  contact_title text,        -- for banks
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_firms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own master firms"
  ON public.master_firms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own master firms"
  ON public.master_firms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own master firms"
  ON public.master_firms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own master firms"
  ON public.master_firms FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_master_firms_updated_at
  BEFORE UPDATE ON public.master_firms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Master contacts directory (user-scoped, not company-scoped)
CREATE TABLE public.master_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_name text NOT NULL,
  contact_type text NOT NULL DEFAULT 'attorney', -- 'attorney', 'accountant'
  firm_id uuid REFERENCES public.master_firms(id) ON DELETE SET NULL,
  title text,
  bar_number text,      -- for attorneys
  cpa_number text,      -- for accountants
  specialty text,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.master_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own master contacts"
  ON public.master_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own master contacts"
  ON public.master_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own master contacts"
  ON public.master_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own master contacts"
  ON public.master_contacts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_master_contacts_updated_at
  BEFORE UPDATE ON public.master_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_master_firms_user_id ON public.master_firms(user_id);
CREATE INDEX idx_master_firms_type ON public.master_firms(firm_type);
CREATE INDEX idx_master_contacts_user_id ON public.master_contacts(user_id);
CREATE INDEX idx_master_contacts_type ON public.master_contacts(contact_type);
CREATE INDEX idx_master_contacts_firm_id ON public.master_contacts(firm_id);
