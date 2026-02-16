
-- Create storage bucket for tax return uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('tax-returns', 'tax-returns', false);

-- RLS: Users can upload their own tax returns
CREATE POLICY "Users can upload tax returns"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'tax-returns' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can view their own tax returns
CREATE POLICY "Users can view own tax returns"
ON storage.objects FOR SELECT
USING (bucket_id = 'tax-returns' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can delete their own tax returns
CREATE POLICY "Users can delete own tax returns"
ON storage.objects FOR DELETE
USING (bucket_id = 'tax-returns' AND auth.uid()::text = (storage.foldername(name))[1]);
