-- Create a public storage bucket for resource images
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-images', 'resource-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Admins can upload resource images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resource-images' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Allow anyone to view resource images (public bucket)
CREATE POLICY "Anyone can view resource images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resource-images');

-- Allow admins to delete resource images
CREATE POLICY "Admins can delete resource images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resource-images' AND
  public.has_role(auth.uid(), 'admin'::public.app_role)
);