
-- Create company_relationships table
CREATE TABLE public.company_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'subsidiary',
  ownership_percentage numeric CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100),
  effective_date date,
  notes text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_company_id, child_company_id),
  CHECK (parent_company_id != child_company_id)
);

-- Enable RLS
ALTER TABLE public.company_relationships ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own relationships"
  ON public.company_relationships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationships"
  ON public.company_relationships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationships"
  ON public.company_relationships FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationships"
  ON public.company_relationships FOR DELETE
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_company_relationships_updated_at
  BEFORE UPDATE ON public.company_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
