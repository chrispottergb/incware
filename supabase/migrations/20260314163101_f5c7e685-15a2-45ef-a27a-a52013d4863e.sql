
ALTER TABLE public.ai_systems
  -- Identity & Provenance
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS internal_identifier text,
  ADD COLUMN IF NOT EXISTS deployer_type text DEFAULT 'vendor',
  ADD COLUMN IF NOT EXISTS foundation_model text,
  ADD COLUMN IF NOT EXISTS vendor_intended_use text,
  -- Impact Classification
  ADD COLUMN IF NOT EXISTS decision_domains text,
  ADD COLUMN IF NOT EXISTS triggered_state_laws text,
  ADD COLUMN IF NOT EXISTS nist_impact_level text,
  ADD COLUMN IF NOT EXISTS impact_justification text,
  -- Sector Regulatory Hooks
  ADD COLUMN IF NOT EXISTS sector_regulatory_hooks text,
  -- Responsible Persons
  ADD COLUMN IF NOT EXISTS risk_owner text,
  ADD COLUMN IF NOT EXISTS technical_monitor text,
  ADD COLUMN IF NOT EXISTS compliance_lead text,
  ADD COLUMN IF NOT EXISTS legal_contact text,
  -- Oversight Controls
  ADD COLUMN IF NOT EXISTS human_override_capability boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_override_tested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS explainable_output boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS adverse_action_notice_in_place boolean DEFAULT false,
  -- Data & Bias
  ADD COLUMN IF NOT EXISTS training_dataset_info text,
  ADD COLUMN IF NOT EXISTS disparate_impact_analysis_done boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS protected_classes_analyzed text,
  ADD COLUMN IF NOT EXISTS proxy_features_excluded boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_privacy_basis text;
