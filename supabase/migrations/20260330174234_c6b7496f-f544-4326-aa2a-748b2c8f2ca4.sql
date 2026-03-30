update storage.buckets
set public = true
where id = 'generated-documents';

drop policy if exists "Public can read generated documents" on storage.objects;
create policy "Public can read generated documents"
on storage.objects
for select
to public
using (bucket_id = 'generated-documents');