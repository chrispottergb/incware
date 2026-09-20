ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS irs_form_type text;

CREATE TABLE public.nonprofit_financial_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL,
  fiscal_year_label text,
  period_start date,
  period_end date,
  is_audited boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT true,
  return_filed_date date,
  documented_date date NOT NULL DEFAULT CURRENT_DATE,
  board_reviewed_date date,
  contributions_grants numeric,
  program_service_revenue numeric,
  membership_dues numeric,
  investment_income numeric,
  fundraising_events_net numeric,
  in_kind_contributions numeric,
  other_revenue numeric,
  total_revenue numeric,
  program_services_expense numeric,
  management_general_expense numeric,
  fundraising_expense numeric,
  total_expenses numeric,
  net_assets_without_restrictions numeric,
  net_assets_with_restrictions numeric,
  net_assets_beginning numeric,
  change_in_net_assets numeric,
  net_assets_ending numeric,
  total_assets numeric,
  total_liabilities numeric,
  gross_receipts_under_threshold boolean,
  board_acknowledgment text,
  source_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nonprofit_financial_statements_company_year_unique UNIQUE (company_id, fiscal_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nonprofit_financial_statements TO authenticated;
GRANT ALL ON public.nonprofit_financial_statements TO service_role;

ALTER TABLE public.nonprofit_financial_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own nonprofit financial statements"
ON public.nonprofit_financial_statements
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = nonprofit_financial_statements.company_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = nonprofit_financial_statements.company_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_nonprofit_financial_statements_updated_at
BEFORE UPDATE ON public.nonprofit_financial_statements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meeting_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  source_statement_id uuid REFERENCES public.nonprofit_financial_statements(id) ON DELETE SET NULL,
  source_statement_updated_at timestamptz,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshotted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meeting_financial_snapshots_meeting_unique UNIQUE (meeting_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_financial_snapshots TO authenticated;
GRANT ALL ON public.meeting_financial_snapshots TO service_role;

ALTER TABLE public.meeting_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting financial snapshots"
ON public.meeting_financial_snapshots
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.meetings m JOIN public.companies c ON c.id = m.company_id WHERE m.id = meeting_financial_snapshots.meeting_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m JOIN public.companies c ON c.id = m.company_id WHERE m.id = meeting_financial_snapshots.meeting_id AND c.user_id = auth.uid()));

CREATE TRIGGER update_meeting_financial_snapshots_updated_at
BEFORE UPDATE ON public.meeting_financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();