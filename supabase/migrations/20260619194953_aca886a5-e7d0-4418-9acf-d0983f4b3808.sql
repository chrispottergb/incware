
CREATE POLICY "Admins read pricing screenshots" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'competitor-pricing-screenshots' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload pricing screenshots" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'competitor-pricing-screenshots' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update pricing screenshots" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'competitor-pricing-screenshots' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete pricing screenshots" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'competitor-pricing-screenshots' AND public.has_role(auth.uid(), 'admin'));
