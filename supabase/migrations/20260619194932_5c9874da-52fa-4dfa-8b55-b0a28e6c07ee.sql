
CREATE TABLE public.competitor_pricing_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,
  plan_name text NOT NULL,
  price_amount numeric(12,2),
  price_display text NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  features text[] NOT NULL DEFAULT '{}',
  notes text,
  our_positioning text,
  source_url text,
  screenshot_path text,
  verified_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitor_pricing_entries TO authenticated;
GRANT ALL ON public.competitor_pricing_entries TO service_role;

ALTER TABLE public.competitor_pricing_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read pricing entries" ON public.competitor_pricing_entries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert pricing entries" ON public.competitor_pricing_entries
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update pricing entries" ON public.competitor_pricing_entries
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete pricing entries" ON public.competitor_pricing_entries
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_competitor_pricing_entries_updated
  BEFORE UPDATE ON public.competitor_pricing_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.competitor_pricing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.competitor_pricing_entries(id) ON DELETE CASCADE,
  change_type text NOT NULL,
  previous_price_display text,
  new_price_display text,
  previous_price_amount numeric(12,2),
  new_price_amount numeric(12,2),
  diff jsonb,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.competitor_pricing_history TO authenticated;
GRANT ALL ON public.competitor_pricing_history TO service_role;

ALTER TABLE public.competitor_pricing_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read pricing history" ON public.competitor_pricing_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert pricing history" ON public.competitor_pricing_history
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_pricing_history_entry ON public.competitor_pricing_history(entry_id, changed_at DESC);

-- Auto-log changes
CREATE OR REPLACE FUNCTION public.log_competitor_pricing_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.competitor_pricing_history(entry_id, change_type, new_price_display, new_price_amount, changed_by)
    VALUES (NEW.id, 'created', NEW.price_display, NEW.price_amount, NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.price_display IS DISTINCT FROM OLD.price_display
       OR NEW.price_amount IS DISTINCT FROM OLD.price_amount
       OR NEW.billing_cycle IS DISTINCT FROM OLD.billing_cycle
       OR NEW.plan_name IS DISTINCT FROM OLD.plan_name
       OR NEW.features IS DISTINCT FROM OLD.features THEN
      INSERT INTO public.competitor_pricing_history(
        entry_id, change_type, previous_price_display, new_price_display,
        previous_price_amount, new_price_amount, diff, changed_by
      ) VALUES (
        NEW.id, 'updated', OLD.price_display, NEW.price_display,
        OLD.price_amount, NEW.price_amount,
        jsonb_build_object(
          'plan_name', jsonb_build_array(OLD.plan_name, NEW.plan_name),
          'billing_cycle', jsonb_build_array(OLD.billing_cycle, NEW.billing_cycle),
          'features', jsonb_build_array(to_jsonb(OLD.features), to_jsonb(NEW.features))
        ),
        auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_log_competitor_pricing_change
  AFTER INSERT OR UPDATE ON public.competitor_pricing_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_competitor_pricing_change();
