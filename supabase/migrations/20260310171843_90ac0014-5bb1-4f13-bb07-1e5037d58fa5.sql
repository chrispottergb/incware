
CREATE TABLE public.meeting_non_recurring_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_non_recurring_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting non-recurring items"
  ON public.meeting_non_recurring_items
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN companies c ON c.id = m.company_id
      WHERE m.id = meeting_non_recurring_items.meeting_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN companies c ON c.id = m.company_id
      WHERE m.id = meeting_non_recurring_items.meeting_id
        AND c.user_id = auth.uid()
    )
  );
