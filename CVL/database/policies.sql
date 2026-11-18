-- Civil Engineering Academy 3D | المرحلة 2 | الملف 2 من 2
-- شغّله بعد schema.sql. قابل لإعادة التشغيل (يحذف سياساتنا ca_* ويعيد إنشاءها).

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies
    where policyname like 'ca\_%' and (schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects'))
  loop execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename); end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['app_settings','profiles','academic_years','domains','units','lessons','lesson_contents','payments','subscriptions','lesson_progress','favorites','announcements'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ===== صلاحيات الجداول =====
revoke all on all tables in schema public from anon;
-- الطالب يعدّل اسمه وصورته فقط، ولا يستطيع تغيير role أو trial_ends_at
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (full_name, avatar_path) on public.profiles to authenticated;

-- ===== المدير: كل شيء في جداول المحتوى والاشتراكات =====
do $$ declare t text; begin
  foreach t in array array['app_settings','academic_years','domains','units','lessons','lesson_contents','payments','subscriptions','announcements'] loop
    execute format('create policy ca_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  foreach t in array array['profiles','lesson_progress','favorites'] loop
    execute format('create policy ca_admin_read on public.%I for select to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ===== الطالب =====
create policy ca_profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy ca_profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- الهيكل (سنوات/مجالات/وحدات/عناوين الدروس) مرئي دائماً للمسجلين ليروا الكتالوج
create policy ca_years_read on public.academic_years for select to authenticated using (is_published);
create policy ca_domains_read on public.domains for select to authenticated
  using (is_published and exists (select 1 from public.academic_years y where y.id = domains.year_id));
create policy ca_units_read on public.units for select to authenticated
  using (is_published and exists (select 1 from public.domains d where d.id = units.domain_id));
create policy ca_lessons_read on public.lessons for select to authenticated using (public.lesson_visible(id));

-- المحتوى نفسه يتطلب تجربة سارية أو اشتراكاً فعّالاً
create policy ca_contents_read on public.lesson_contents for select to authenticated
  using (public.has_access() and public.lesson_visible(lesson_id));

create policy ca_subs_read on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy ca_pay_read on public.payments for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ca_pay_insert on public.payments;
create policy ca_pay_insert on public.payments for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null
    and admin_note is null
    and exists (select 1 from public.plans p where p.id = payments.plan_id and p.is_active
      and p.price_da = payments.amount_da and p.duration_days = payments.duration_days and p.name = payments.plan_name));

create policy ca_progress_own on public.lesson_progress for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.has_access() and public.lesson_visible(lesson_id));
create policy ca_favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.lesson_visible(lesson_id));

create policy ca_announcements_read on public.announcements for select to authenticated using (is_published);
create policy ca_settings_read on public.app_settings for select to authenticated using (true);

-- ===== صلاحيات الدوال =====
revoke execute on function public.confirm_payment(uuid), public.reject_payment(uuid, text), public.admin_stats(),
  public.my_access(), public.has_access(), public.is_admin(), public.lesson_visible(uuid), public.setting_int(text, int)
  from public, anon;
grant execute on function public.confirm_payment(uuid), public.reject_payment(uuid, text), public.admin_stats(),
  public.my_access(), public.has_access(), public.is_admin(), public.lesson_visible(uuid), public.setting_int(text, int)
  to authenticated;
grant execute on function public.year_stats() to anon, authenticated;

-- ===== Storage =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('lesson-html',     'lesson-html',     false, 5242880,  array['text/html']),
  ('lesson-pdf',      'lesson-pdf',      false, 52428800, array['application/pdf']),
  ('lesson-videos',   'lesson-videos',   false, 52428800, array['video/mp4','video/webm']),
  ('lesson-covers',   'lesson-covers',   true,  3145728,  array['image/jpeg','image/png','image/webp']),
  ('student-avatars', 'student-avatars', false, 2097152,  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- المدير: رفع وقراءة وتعديل وحذف ملفات الدروس
create policy ca_files_admin on storage.objects for all to authenticated
  using (bucket_id in ('lesson-html','lesson-pdf','lesson-videos','lesson-covers') and public.is_admin())
  with check (bucket_id in ('lesson-html','lesson-pdf','lesson-videos','lesson-covers') and public.is_admin());

-- الطالب: يقرأ فقط ملفاً مرتبطاً بدرس منشور، وبشرط وجود صلاحية وصول
create policy ca_files_read on storage.objects for select to authenticated
  using (bucket_id in ('lesson-html','lesson-pdf','lesson-videos') and public.has_access()
    and exists (select 1 from public.lesson_contents c where c.storage_path = objects.name and public.lesson_visible(c.lesson_id)));

create policy ca_covers_read on storage.objects for select to anon, authenticated using (bucket_id = 'lesson-covers');

-- الصور الشخصية: كل مستخدم داخل مجلد باسم معرّفه (uid/avatar.jpg)
create policy ca_avatar_own on storage.objects for all to authenticated
  using (bucket_id = 'student-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'student-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy ca_avatar_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'student-avatars' and public.is_admin());

-- ===== اجعل نفسك مديراً (بعد أن تسجّل حسابك من الموقع). عدّل البريد ثم شغّله: =====
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');

-- ===== المرحلة 8: صلاحيات الخطط =====
alter table public.plans enable row level security;
revoke all on public.plans from anon;
drop policy if exists ca_admin_all on public.plans;
create policy ca_admin_all on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ca_plans_read on public.plans;
create policy ca_plans_read on public.plans for select to authenticated using (is_active);
grant execute on function public.public_pricing() to anon, authenticated;

-- ===== المرحلة 9: شعار الموقع (Bucket عام للقراءة، والكتابة للمدير فقط) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('site-assets', 'site-assets', true, 1048576, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists ca_site_read on storage.objects;
create policy ca_site_read on storage.objects for select to anon, authenticated using (bucket_id = 'site-assets');
drop policy if exists ca_site_admin on storage.objects;
create policy ca_site_admin on storage.objects for all to authenticated
  using (bucket_id = 'site-assets' and public.is_admin()) with check (bucket_id = 'site-assets' and public.is_admin());
