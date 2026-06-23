CREATE TABLE public.llc_managers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title         text NOT NULL,
  name          text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX llc_managers_company_order_idx
  ON public.llc_managers (company_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.llc_managers TO authenticated;
GRANT ALL ON public.llc_managers TO service_role;

ALTER TABLE public.llc_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select their llc_managers"
ON public.llc_managers FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE POLICY "Owners insert their llc_managers"
ON public.llc_managers FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE POLICY "Owners update their llc_managers"
ON public.llc_managers FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE POLICY "Owners delete their llc_managers"
ON public.llc_managers FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.id = llc_managers.company_id AND c.user_id = auth.uid()
));

CREATE TRIGGER llc_managers_set_updated_at
BEFORE UPDATE ON public.llc_managers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.llc_managers (company_id, title, name, display_order)
SELECT c.id, v.title, v.nm, v.ord
FROM public.companies c
JOIN public.officers o ON o.company_id = c.id
CROSS JOIN LATERAL (VALUES
  ('Managing Member',   o.president,      0),
  ('Assistant Manager', o.vice_president, 1),
  ('Secretary',         o.secretary,      2),
  ('Treasurer',         o.treasurer,      3)
) AS v(title, nm, ord)
WHERE c.entity_type IN ('LLC','LLC-S','Single Member LLC')
  AND COALESCE(v.nm, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.llc_managers m WHERE m.company_id = c.id);