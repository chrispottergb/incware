
CREATE TABLE public.shortcode_expansions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shortcode text NOT NULL,
  expansion_text text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, shortcode)
);

ALTER TABLE public.shortcode_expansions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shortcodes" ON public.shortcode_expansions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shortcodes" ON public.shortcode_expansions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shortcodes" ON public.shortcode_expansions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shortcodes" ON public.shortcode_expansions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_shortcode_expansions_updated_at BEFORE UPDATE ON public.shortcode_expansions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
