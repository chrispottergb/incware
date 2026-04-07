ALTER TABLE share_transactions
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN corrected_by_id uuid REFERENCES share_transactions(id) ON DELETE SET NULL,
  ADD COLUMN corrects_id uuid REFERENCES share_transactions(id) ON DELETE SET NULL,
  ADD COLUMN correction_memo text;