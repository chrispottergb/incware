
-- Annual review links table: stores generated secure tokens for client access
CREATE TABLE public.annual_review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  review_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Annual review submissions: stores the client's responses as JSON
CREATE TABLE public.annual_review_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.annual_review_links(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_review',
  pre_populated_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_entries jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.annual_review_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_review_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: Admin can manage their own links
CREATE POLICY "Users can manage own review links"
ON public.annual_review_links
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS: Admin can manage submissions for their companies
CREATE POLICY "Users can manage own review submissions"
ON public.annual_review_submissions
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.companies
  WHERE companies.id = annual_review_submissions.company_id
  AND companies.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.companies
  WHERE companies.id = annual_review_submissions.company_id
  AND companies.user_id = auth.uid()
));

-- Allow anonymous access for public form submission via service role edge function
-- (The edge function will validate the token and insert/update using service role)
