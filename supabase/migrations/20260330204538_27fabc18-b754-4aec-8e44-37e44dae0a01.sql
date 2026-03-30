
CREATE TABLE public.meeting_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL,
  party_name text NOT NULL DEFAULT '',
  relationship text DEFAULT '',
  beginning_balance numeric DEFAULT 0,
  advances numeric DEFAULT 0,
  repayments numeric DEFAULT 0,
  ending_balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.meeting_balance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting balance entries"
  ON public.meeting_balance_entries FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN companies c ON c.id = m.company_id
      WHERE m.id = meeting_balance_entries.meeting_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings m
      JOIN companies c ON c.id = m.company_id
      WHERE m.id = meeting_balance_entries.meeting_id
      AND c.user_id = auth.uid()
    )
  );
