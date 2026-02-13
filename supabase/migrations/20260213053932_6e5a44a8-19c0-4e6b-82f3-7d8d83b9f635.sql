
-- AI Systems Registry
CREATE TABLE public.ai_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  system_name text NOT NULL,
  provider text,
  risk_level text NOT NULL DEFAULT 'minimal',
  purpose text,
  deployment_date date,
  status text NOT NULL DEFAULT 'active',
  instructions_for_use text,
  data_categories text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_systems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ai_systems" ON public.ai_systems FOR SELECT USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_systems.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company ai_systems" ON public.ai_systems FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_systems.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company ai_systems" ON public.ai_systems FOR UPDATE USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_systems.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company ai_systems" ON public.ai_systems FOR DELETE USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_systems.company_id AND companies.user_id = auth.uid()));

CREATE TRIGGER update_ai_systems_updated_at BEFORE UPDATE ON public.ai_systems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Oversight Persons
CREATE TABLE public.ai_oversight_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id uuid NOT NULL REFERENCES public.ai_systems(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  title text,
  competence_description text,
  authority_scope text,
  assigned_date date DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_oversight_persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_oversight_persons" ON public.ai_oversight_persons FOR ALL USING (EXISTS (SELECT 1 FROM ai_systems s JOIN companies c ON c.id = s.company_id WHERE s.id = ai_oversight_persons.ai_system_id AND c.user_id = auth.uid()));

-- AI Usage Logs
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id uuid NOT NULL REFERENCES public.ai_systems(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  usage_date timestamptz NOT NULL DEFAULT now(),
  usage_type text NOT NULL DEFAULT 'general',
  description text,
  input_summary text,
  output_summary text,
  human_reviewer text,
  review_decision text,
  review_notes text,
  affected_persons_notified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ai_usage_logs" ON public.ai_usage_logs FOR SELECT USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_usage_logs.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company ai_usage_logs" ON public.ai_usage_logs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_usage_logs.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company ai_usage_logs" ON public.ai_usage_logs FOR UPDATE USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_usage_logs.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company ai_usage_logs" ON public.ai_usage_logs FOR DELETE USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_usage_logs.company_id AND companies.user_id = auth.uid()));

-- AI Risk Incidents
CREATE TABLE public.ai_risk_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id uuid NOT NULL REFERENCES public.ai_systems(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  severity text NOT NULL DEFAULT 'low',
  description text,
  actions_taken text,
  provider_notified boolean DEFAULT false,
  authority_notified boolean DEFAULT false,
  reported_by text,
  resolution_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_risk_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company ai_risk_incidents" ON public.ai_risk_incidents FOR SELECT USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_risk_incidents.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can insert own company ai_risk_incidents" ON public.ai_risk_incidents FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_risk_incidents.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can update own company ai_risk_incidents" ON public.ai_risk_incidents FOR UPDATE USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_risk_incidents.company_id AND companies.user_id = auth.uid()));
CREATE POLICY "Users can delete own company ai_risk_incidents" ON public.ai_risk_incidents FOR DELETE USING (EXISTS (SELECT 1 FROM companies WHERE companies.id = ai_risk_incidents.company_id AND companies.user_id = auth.uid()));

-- Storage bucket for AI compliance documents
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-compliance-docs', 'ai-compliance-docs', false);

CREATE POLICY "Users can view own company ai docs" ON storage.objects FOR SELECT USING (bucket_id = 'ai-compliance-docs' AND EXISTS (SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND (storage.foldername(name))[1] = 'company-' || companies.id::text));
CREATE POLICY "Users can upload own company ai docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ai-compliance-docs' AND EXISTS (SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND (storage.foldername(name))[1] = 'company-' || companies.id::text));
CREATE POLICY "Users can delete own company ai docs" ON storage.objects FOR DELETE USING (bucket_id = 'ai-compliance-docs' AND EXISTS (SELECT 1 FROM companies WHERE companies.user_id = auth.uid() AND (storage.foldername(name))[1] = 'company-' || companies.id::text));
