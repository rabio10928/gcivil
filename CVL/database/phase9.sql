-- المرحلة 9: هوية الموقع والشعار. شغّله مرة واحدة إن كنت قد شغّلت schema.sql وpolicies.sql سابقاً (آمن لإعادة التشغيل).

-- ===== المرحلة 9: هوية الموقع (عامة للزوار: الاسم والشعار والنصوص وبيانات التواصل فقط) =====
create or replace function public.public_site() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = 'site' and jsonb_typeof(value) = 'object'), '{}'::jsonb);
$$;
grant execute on function public.public_site() to anon, authenticated;

-- ===== المرحلة 9: شعار الموقع (Bucket عام للقراءة، والكتابة للمدير فقط) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('site-assets', 'site-assets', true, 1048576, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists ca_site_read on storage.objects;
create policy ca_site_read on storage.objects for select to anon, authenticated using (bucket_id = 'site-assets');
drop policy if exists ca_site_admin on storage.objects;
create policy ca_site_admin on storage.objects for all to authenticated
  using (bucket_id = 'site-assets' and public.is_admin()) with check (bucket_id = 'site-assets' and public.is_admin());
