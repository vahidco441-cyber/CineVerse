-- CineVerse media storage setup
-- Run this once in the SQL editor of the project's database.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cineverse-media',
  'cineverse-media',
  true,
  2147483648,
  array[
    'image/jpeg','image/png','image/webp',
    'video/mp4','video/webm','video/quicktime','video/x-matroska','application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "CineVerse public media read" on storage.objects;
create policy "CineVerse public media read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'cineverse-media');

drop policy if exists "CineVerse admins media upload" on storage.objects;
create policy "CineVerse admins media upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cineverse-media'
  and exists (select 1 from public.cv_admins a where a.user_id = auth.uid())
);

drop policy if exists "CineVerse admins media update" on storage.objects;
create policy "CineVerse admins media update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'cineverse-media'
  and exists (select 1 from public.cv_admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'cineverse-media'
  and exists (select 1 from public.cv_admins a where a.user_id = auth.uid())
);

drop policy if exists "CineVerse admins media delete" on storage.objects;
create policy "CineVerse admins media delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'cineverse-media'
  and exists (select 1 from public.cv_admins a where a.user_id = auth.uid())
);
