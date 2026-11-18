\set A '''00000000-0000-0000-0000-00000000000a'''
\set S1 '''00000000-0000-0000-0000-000000000001'''
\set S2 '''00000000-0000-0000-0000-000000000002'''
\set S3 '''00000000-0000-0000-0000-000000000003'''
create table _res(name text, ok boolean, info text); grant all on _res to public;
create function _t(n text, c boolean, i text default '') returns void language sql as $$ insert into _res values (n, coalesce(c,false), i) $$;
create function _as(u uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false);
  if u is null then set role anon; else set role authenticated; end if; end $$;
create function _cnt(n text, q text, e bigint) returns void language plpgsql as $$ declare c bigint; begin
  execute q into c; perform _t(n, c = e, 'got '||c||' want '||e);
  exception when others then perform _t(n, false, 'ERR '||sqlerrm); end $$;
create function _err(n text, q text) returns void language plpgsql as $$ begin
  execute q; perform _t(n, false, 'expected error, got none');
  exception when others then perform _t(n, true, sqlerrm); end $$;
create function _ok(n text, q text) returns void language plpgsql as $$ begin
  execute q; perform _t(n, true);
  exception when others then perform _t(n, false, 'ERR '||sqlerrm); end $$;

-- ===== بيانات =====
insert into auth.users (id,email,raw_user_meta_data) values
 (:A,'a@x','{"full_name":"Admin"}'),(:S1,'s1@x','{"full_name":"Stu One","role":"admin"}'),(:S2,'s2@x','{}'),(:S3,'s3@x','{}');
select _t('trigger: metadata role ignored', (select role from profiles where id=:S1)='student');
select _t('trigger: trial 7 days', (select trial_ends_at - now() from profiles where id=:S1) between interval '6.9 days' and interval '7.1 days');
select _t('trigger: name fallback/meta', (select full_name from profiles where id=:S2)='s2');
update profiles set role='admin' where id=:A;
update profiles set trial_ends_at = now() - interval '1 day' where id in (:S2,:S3);
insert into subscriptions (user_id, ends_at) values (:S3, now()+interval '30 days');
insert into plans(id,name,price_da,duration_days,is_active) values ('50000000-0000-0000-0000-000000000001','Annual',2500,365,true),('50000000-0000-0000-0000-000000000002','Monthly',900,30,true),('50000000-0000-0000-0000-000000000003','Old',1000,90,false);
insert into academic_years(id,title) values ('10000000-0000-0000-0000-000000000001','Y1');
insert into domains(id,year_id,title,is_published) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','D1',true),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','D2',false);
insert into units(id,domain_id,title) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','U1'),('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','U2');
insert into lessons(id,unit_id,title,status) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','L1','published'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','L2 draft','draft'),
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','L3 hidden domain','published'),
 ('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','L4 hidden','hidden');
insert into lesson_contents(lesson_id,type,storage_path) values
 ('40000000-0000-0000-0000-000000000001','html','L1/a.html'),('40000000-0000-0000-0000-000000000001','pdf','L1/a.pdf'),
 ('40000000-0000-0000-0000-000000000002','html','L2/d.html'),('40000000-0000-0000-0000-000000000003','html','L3/x.html');
insert into storage.objects(bucket_id,name) values ('lesson-html','L1/a.html'),('lesson-html','L2/d.html'),('lesson-html','L3/x.html'),('lesson-pdf','L1/a.pdf'),
 ('student-avatars','00000000-0000-0000-0000-000000000001/avatar.png'),('student-avatars','00000000-0000-0000-0000-000000000002/avatar.png');

-- ===== S1: تجربة سارية =====
select _as(:S1);
select _t('S1 has_access (trial)', has_access());
select _cnt('S1 sees only L1 lesson', 'select count(*) from lessons', 1);
select _cnt('S1 sees D1 only', 'select count(*) from domains', 1);
select _cnt('S1 sees U1 only', 'select count(*) from units', 1);
select _cnt('S1 contents = 2 (no draft/hidden-parent)', 'select count(*) from lesson_contents', 2);
select _cnt('S1 profiles = own only', 'select count(*) from profiles', 1);
select _err('S1 cannot set own role', $q$update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000001'$q$);
select _err('S1 cannot extend trial', $q$update public.profiles set trial_ends_at = now()+interval '999 days' where id='00000000-0000-0000-0000-000000000001'$q$);
select _cnt('S1 can edit own name', $q$with u as (update public.profiles set full_name='New' where id='00000000-0000-0000-0000-000000000001' returning 1) select count(*) from u$q$, 1);
select _cnt('S1 cannot edit others name', $q$with u as (update public.profiles set full_name='Hack' where id='00000000-0000-0000-0000-000000000002' returning 1) select count(*) from u$q$, 0);
select _err('S1 cannot insert subscription', $q$insert into public.subscriptions(user_id,ends_at) values ('00000000-0000-0000-0000-000000000001', now()+interval '999 days')$q$);
select _err('S1 payment wrong amount for plan', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',100,'BAD1','50000000-0000-0000-0000-000000000001','Annual',365)$q$);
select _err('S1 payment forged duration', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',2500,'BAD1b','50000000-0000-0000-0000-000000000001','Annual',30)$q$);
select _err('S1 payment forged plan name', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',2500,'BAD1c','50000000-0000-0000-0000-000000000001','Free',365)$q$);
select _err('S1 payment on inactive plan', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',1000,'BAD1d','50000000-0000-0000-0000-000000000003','Old',90)$q$);
select _err('S1 payment without plan', $q$insert into public.payments(user_id,amount_da,reference) values ('00000000-0000-0000-0000-000000000001',2500,'BAD1e')$q$);
select _err('S1 payment pre-confirmed', $q$insert into public.payments(user_id,amount_da,reference,status,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',2500,'BAD2','confirmed','50000000-0000-0000-0000-000000000001','Annual',365)$q$);
select _err('S1 payment for other user', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000002',2500,'BAD3','50000000-0000-0000-0000-000000000001','Annual',365)$q$);
select _ok('S1 valid pending payment (Annual plan)', $q$insert into public.payments(user_id,amount_da,reference,method,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',2500,'REF-1','ccp','50000000-0000-0000-0000-000000000001','Annual',365)$q$);
select _err('S1 second pending blocked', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',2500,'REF-2','50000000-0000-0000-0000-000000000001','Annual',365)$q$);
select _err('S1 cannot self-confirm', $q$select public.confirm_payment((select id from public.payments limit 1))$q$);
select _cnt('S1 cannot update payment', $q$with u as (update public.payments set status='confirmed' returning 1) select count(*) from u$q$, 0);
select _ok('S1 progress on L1', $q$insert into public.lesson_progress(user_id,lesson_id,progress_pct) values ('00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',50)$q$);
select _ok('S1 progress upsert', $q$insert into public.lesson_progress(user_id,lesson_id,last_opened_at) values ('00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',now()) on conflict (user_id,lesson_id) do update set last_opened_at=excluded.last_opened_at$q$);
select _err('S1 progress on draft lesson', $q$insert into public.lesson_progress(user_id,lesson_id) values ('00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002')$q$);
select _err('S1 progress as other user', $q$insert into public.lesson_progress(user_id,lesson_id) values ('00000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001')$q$);
select _ok('S1 favorite L1', $q$insert into public.favorites(user_id,lesson_id) values ('00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001')$q$);
select _err('S1 favorite draft', $q$insert into public.favorites(user_id,lesson_id) values ('00000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002')$q$);
select _cnt('S1 storage html = 1 (L1 only)', $q$select count(*) from storage.objects where bucket_id='lesson-html'$q$, 1);
select _cnt('S1 storage pdf = 1', $q$select count(*) from storage.objects where bucket_id='lesson-pdf'$q$, 1);
select _err('S1 cannot upload lesson file', $q$insert into storage.objects(bucket_id,name) values ('lesson-html','evil.html')$q$);
select _cnt('S1 avatars = own only', $q$select count(*) from storage.objects where bucket_id='student-avatars'$q$, 1);
select _ok('S1 upload own avatar', $q$insert into storage.objects(bucket_id,name) values ('student-avatars','00000000-0000-0000-0000-000000000001/new.png')$q$);
select _err('S1 upload avatar in other folder', $q$insert into storage.objects(bucket_id,name) values ('student-avatars','00000000-0000-0000-0000-000000000002/x.png')$q$);
select _err('S1 admin_stats denied', $q$select public.admin_stats()$q$);
select _cnt('S1 cannot write settings', $q$with u as (update public.app_settings set value='1' returning 1) select count(*) from u$q$, 0);
select _cnt('S1 reads settings', 'select count(*) from app_settings', 4);
select _cnt('S1 sees active plans only', 'select count(*) from plans', 3);
select _cnt('S1 cannot edit plans', $q$with u as (update public.plans set price_da=1 returning 1) select count(*) from u$q$, 0);
select _err('S1 cannot insert plan', $q$insert into public.plans(name,price_da,duration_days) values ('free',1,3650)$q$);
select _err('S1 cannot insert lesson', $q$insert into public.lessons(unit_id,title,status) values ('30000000-0000-0000-0000-000000000001','x','published')$q$);

-- ===== S2: تجربة منتهية =====
reset role; select _as(:S2);
select _t('S2 no access', not has_access());
select _cnt('S2 still sees lesson titles', 'select count(*) from lessons', 1);
select _cnt('S2 contents = 0', 'select count(*) from lesson_contents', 0);
select _cnt('S2 storage html = 0', $q$select count(*) from storage.objects where bucket_id='lesson-html'$q$, 0);
select _err('S2 progress blocked', $q$insert into public.lesson_progress(user_id,lesson_id) values ('00000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001')$q$);
select _cnt('S2 cannot see S1 payment', 'select count(*) from payments', 0);
select _err('S2 duplicate reference blocked (case-insens)', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000002',900,'ref-1','50000000-0000-0000-0000-000000000002','Monthly',30)$q$);
select _ok('S2 pending payment (Monthly plan)', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000002',900,'REF-S2','50000000-0000-0000-0000-000000000002','Monthly',30)$q$);
select _cnt('S2 cannot edit payments', $q$with u as (update public.payments set reference='X' returning 1) select count(*) from u$q$, 0);
-- ===== مدير =====
reset role; select _as(:A);
select _t('admin has_access', has_access());
select _t('admin is_admin', is_admin());
select _cnt('admin sees 4 lessons', 'select count(*) from lessons', 4);
select _cnt('admin sees all profiles', 'select count(*) from profiles', 4);
select _cnt('admin sees 2 payments', 'select count(*) from payments', 2);
select _ok('admin admin_stats', 'select public.admin_stats()');
select _err('admin cannot change roles via API', $q$update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000002'$q$);
select _ok('admin uploads file', $q$insert into storage.objects(bucket_id,name) values ('lesson-html','new/ok.html')$q$);
select _cnt('admin storage html = 4', $q$select count(*) from storage.objects where bucket_id='lesson-html'$q$, 4);
select _ok('admin confirm S2', $q$select public.confirm_payment((select id from public.payments where user_id='00000000-0000-0000-0000-000000000002'))$q$);
select _err('admin double confirm blocked', $q$select public.confirm_payment((select id from public.payments where user_id='00000000-0000-0000-0000-000000000002'))$q$);
select _ok('admin reject S1', $q$select public.reject_payment((select id from public.payments where user_id='00000000-0000-0000-0000-000000000001'),'no match')$q$);
select _ok('admin edits settings', $q$update public.app_settings set value='3000' where key='annual_price_da'$q$);
select _cnt('admin sees all plans incl. inactive', 'select count(*) from plans', 4);
select _ok('admin disables Annual plan', $q$update public.plans set is_active=false where id='50000000-0000-0000-0000-000000000001'$q$);
reset role; select _as(:S1);
select _err('S1 cannot buy disabled plan', $q$insert into public.payments(user_id,amount_da,reference,plan_id,plan_name,duration_days) values ('00000000-0000-0000-0000-000000000001',2500,'REF-X','50000000-0000-0000-0000-000000000001','Annual',365)$q$);
reset role; select _as(:A);
select _ok('admin re-enables plan', $q$update public.plans set is_active=true where id='50000000-0000-0000-0000-000000000001'$q$);
select _ok('admin reset price', $q$update public.app_settings set value='2500' where key='annual_price_da'$q$);
-- ===== بعد تأكيد S2 =====
reset role; select _as(:S2);
select _t('S2 has_access after confirm', has_access());
select _cnt('S2 contents = 2 after confirm', 'select count(*) from lesson_contents', 2);
select _cnt('S2 storage html = 1 after confirm', $q$select count(*) from storage.objects where bucket_id='lesson-html'$q$, 1);
select _t('S2 my_access reason', (public.my_access()->>'reason')='subscription');
reset role;
select _t('sub duration follows plan (30d)', (select ends_at - starts_at from subscriptions where user_id=:S2) = interval '30 days');
select _t('payment confirmed+reviewed', (select status='confirmed' and reviewed_by is not null from payments where user_id=:S2));
update subscriptions set ends_at = now() - interval '1 second', starts_at = now() - interval '2 days' where user_id=:S2;
select _as(:S2); select _t('S2 expired sub -> no access', not has_access()); select _cnt('S2 contents 0 after expiry', 'select count(*) from lesson_contents', 0);
reset role; update subscriptions set status='cancelled', ends_at = now()+interval '10 days', starts_at=now()-interval '1 day' where user_id=:S3;
select _as(:S3); select _t('S3 cancelled sub -> no access', not has_access());
-- ===== زائر =====
reset role; select _as(null);
select _err('anon cannot read lessons', 'select count(*) from lessons');
select _err('anon cannot read profiles', 'select count(*) from profiles');
select _err('anon cannot read settings', 'select count(*) from app_settings');
select _err('anon cannot read plans table', 'select count(*) from plans');
select _cnt('anon public_pricing: 3 active plans', $q$select jsonb_array_length(public.public_pricing()->'plans')$q$, 3);
select _cnt('anon public_pricing hides inactive plan', $q$select count(*) from jsonb_array_elements(public.public_pricing()->'plans') e where e->>'name'='Old'$q$, 0);
select _cnt('anon public_pricing trial_days', $q$select (public.public_pricing()->>'trial_days')::int$q$, 7);
select _err('anon cannot call has_access', 'select public.has_access()');
select _err('anon cannot confirm', $q$select public.confirm_payment(gen_random_uuid())$q$);
select _ok('anon year_stats', 'select * from public.year_stats()');
select _cnt('anon year_stats lessons=1', 'select lesson_count from public.year_stats()', 1);
select _cnt('anon storage covers only', $q$select count(*) from storage.objects where bucket_id in ('lesson-html','lesson-pdf','student-avatars')$q$, 0);
reset role;
insert into auth.users (id,email) values ('00000000-0000-0000-0000-000000000004','s4@x');
insert into payments(user_id,amount_da,reference) values ('00000000-0000-0000-0000-000000000004',2500,'LEGACY-1');
select _as(:A);
select _ok('admin confirms legacy payment (no plan)', $q$select public.confirm_payment((select id from public.payments where reference='LEGACY-1'))$q$);
reset role;
select _t('legacy payment uses settings duration (365d)', (select ends_at - starts_at from subscriptions where user_id='00000000-0000-0000-0000-000000000004') = interval '365 days');
delete from plans where id='50000000-0000-0000-0000-000000000002';
select _t('delete plan keeps payment snapshot', (select plan_id is null and plan_name='Monthly' and duration_days=30 from payments where user_id=:S2));
select _t('delete plan keeps subscription', exists(select 1 from subscriptions where user_id=:S2));
-- ===== هوية الموقع والشعار =====
reset role;
insert into public.app_settings(key,value) values ('site','{"site_name":"أكاديمية","hero_title":"عنوان"}');
insert into storage.objects(bucket_id,name) values ('site-assets','logo/a.png');
select _as(null);
select _cnt('anon public_site returns name', $q$select count(*) from (select public.public_site()->>'site_name' as n) t where n='أكاديمية'$q$, 1);
select _cnt('anon sees site logo', $q$select count(*) from storage.objects where bucket_id='site-assets'$q$, 1);
select _err('anon cannot upload logo', $q$insert into storage.objects(bucket_id,name) values ('site-assets','evil.png')$q$);
select _err('anon cannot read app_settings table', 'select count(*) from app_settings');
reset role; select _as('00000000-0000-0000-0000-000000000001');
select _err('student cannot upload logo', $q$insert into storage.objects(bucket_id,name) values ('site-assets','evil2.png')$q$);
select _cnt('student cannot delete logo', $q$with d as (delete from storage.objects where bucket_id='site-assets' returning 1) select count(*) from d$q$, 0);
select _cnt('student cannot edit site row', $q$with u as (update public.app_settings set value='{}' where key='site' returning 1) select count(*) from u$q$, 0);
reset role; select _as('00000000-0000-0000-0000-00000000000a');
select _ok('admin uploads logo', $q$insert into storage.objects(bucket_id,name) values ('site-assets','logo/b.png')$q$);
select _ok('admin saves site settings', $q$update public.app_settings set value='{"site_name":"جديد"}' where key='site'$q$);
reset role;
select _t('bucket site-assets public + 1MB', (select public and file_size_limit = 1048576 from storage.buckets where id='site-assets'));
-- ===== تمارين HTML (نوع exercises) =====
reset role;
select _ok('exercises type allowed', $q$insert into public.lesson_contents(lesson_id,type,storage_path) values ('40000000-0000-0000-0000-000000000001','exercises','L1/ex.html')$q$);
select _err('unknown content type rejected', $q$insert into public.lesson_contents(lesson_id,type,storage_path) values ('40000000-0000-0000-0000-000000000001','quiz','L1/q.html')$q$);
select _err('one exercises row per lesson', $q$insert into public.lesson_contents(lesson_id,type,storage_path) values ('40000000-0000-0000-0000-000000000001','exercises','L1/ex2.html')$q$);
insert into storage.objects(bucket_id,name) values ('lesson-html','L1/ex.html');
select _as('00000000-0000-0000-0000-000000000001');
select _cnt('student with access reads exercises (3 contents)', 'select count(*) from lesson_contents', 3);
select _cnt('student with access reads exercises file', $q$select count(*) from storage.objects where bucket_id='lesson-html'$q$, 2);
reset role; select _as('00000000-0000-0000-0000-000000000002');
select _cnt('expired student gets no exercises', 'select count(*) from lesson_contents', 0);
select _cnt('expired student gets no exercises file', $q$select count(*) from storage.objects where bucket_id='lesson-html'$q$, 0);
reset role;
\echo ===== RESULTS =====
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from _res;
select name, info from _res where not ok;
