-- المرحلة 7: تقوية الصلاحيات. شغّله مرة واحدة إن كنت قد شغّلت policies.sql سابقاً (آمن لإعادة التشغيل).
-- 1) إعدادات المنصة (ومنها تعليمات الدفع) للمسجّلين فقط، لا للزوار
revoke select on public.app_settings from anon;
drop policy if exists ca_settings_read on public.app_settings;
create policy ca_settings_read on public.app_settings for select to authenticated using (true);
-- 2) إخفاء مجال غير منشور (أو سنة غير منشورة) يخفي ما تحته عن الطلاب
drop policy if exists ca_domains_read on public.domains;
create policy ca_domains_read on public.domains for select to authenticated
  using (is_published and exists (select 1 from public.academic_years y where y.id = domains.year_id));
drop policy if exists ca_units_read on public.units;
create policy ca_units_read on public.units for select to authenticated
  using (is_published and exists (select 1 from public.domains d where d.id = units.domain_id));
