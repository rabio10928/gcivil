-- Civil Engineering Academy 3D | المرحلة 2 | الملف 1 من 2
-- شغّله في Supabase > SQL Editor ثم شغّل policies.sql. قابل لإعادة التشغيل.

-- ===== الإعدادات (السعر والمدد) =====
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('trial_days', '7'), ('subscription_days', '365'), ('annual_price_da', '2500')
on conflict (key) do nothing;

create or replace function public.setting_int(k text, d int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = k), d);
$$;

-- ===== الجداول =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  avatar_path text,
  role text not null default 'student' check (role in ('student','admin')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  year_id uuid not null references public.academic_years(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  title text not null,
  description text,
  cover_path text,
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- نوع واحد من كل صنف لكل درس. storage_path = اسم الملف داخل الـ Bucket.
create table if not exists public.lesson_contents (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  type text not null check (type in ('html','video','pdf','exercises')),
  sort_order int not null default 0,
  storage_path text,
  external_url text,
  downloadable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, type),
  check (storage_path is not null or external_url is not null),
  check (external_url is null or type = 'video')
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_da int not null check (amount_da > 0),
  method text,
  reference text,
  paid_on date,
  status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists payments_reference_uq on public.payments (lower(reference)) where reference is not null and status <> 'rejected';
create unique index if not exists payments_one_pending_uq on public.payments (user_id) where status = 'pending';

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  progress_pct int not null default 0 check (progress_pct between 0 and 100),
  completed boolean not null default false,
  completed_at timestamptz,
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===== فهارس =====
create index if not exists domains_year_idx on public.domains (year_id, sort_order);
create index if not exists units_domain_idx on public.units (domain_id, sort_order);
create index if not exists lessons_unit_idx on public.lessons (unit_id, sort_order);
create index if not exists contents_lesson_idx on public.lesson_contents (lesson_id, sort_order);
create index if not exists contents_path_idx on public.lesson_contents (storage_path);
create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists subs_user_idx on public.subscriptions (user_id, ends_at);
create index if not exists progress_lesson_idx on public.lesson_progress (lesson_id);
create index if not exists favorites_lesson_idx on public.favorites (lesson_id);

-- ===== updated_at تلقائي =====
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['app_settings','profiles','academic_years','domains','units','lessons','lesson_contents','payments','subscriptions','lesson_progress','favorites','announcements'] loop
    execute format('drop trigger if exists trg_updated_at on public.%I', t);
    execute format('create trigger trg_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ===== إنشاء الملف الشخصي والتجربة المجانية عند التسجيل (الوقت من الخادم) =====
-- الدور دائماً student ولا يؤخذ من بيانات المستخدم.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, trial_started_at, trial_ends_at)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 100),
    now(),
    now() + make_interval(days => public.setting_int('trial_days', 7))
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== دوال الصلاحيات =====
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- الوصول للمحتوى: مدير، أو تجربة سارية، أو اشتراك فعّال لم ينتهِ. لا حاجة لمهمة مجدولة.
create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.trial_ends_at > now()))
      or exists (select 1 from public.subscriptions s where s.user_id = auth.uid() and s.status = 'active' and s.starts_at <= now() and s.ends_at > now());
$$;

-- الدرس ظاهر للطلاب فقط إذا كان هو وكل أصوله منشورة
create or replace function public.lesson_visible(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.lessons l
    join public.units u on u.id = l.unit_id
    join public.domains d on d.id = u.domain_id
    join public.academic_years y on y.id = d.year_id
    where l.id = lid and l.status = 'published' and u.is_published and d.is_published and y.is_published);
$$;

create or replace function public.my_access() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'has_access', public.has_access(),
    'is_admin', public.is_admin(),
    'trial_ends_at', (select trial_ends_at from public.profiles where id = auth.uid()),
    'subscription_ends_at', (select max(ends_at) from public.subscriptions where user_id = auth.uid() and status = 'active' and ends_at > now()),
    'reason', case
      when public.is_admin() then 'admin'
      when exists (select 1 from public.subscriptions where user_id = auth.uid() and status = 'active' and starts_at <= now() and ends_at > now()) then 'subscription'
      when exists (select 1 from public.profiles where id = auth.uid() and trial_ends_at > now()) then 'trial'
      else 'none' end);
$$;

-- أعداد المجالات والوحدات والدروس لكل سنة (للصفحة الرئيسية، متاحة للزوار)
create or replace function public.year_stats()
returns table (year_id uuid, domain_count bigint, unit_count bigint, lesson_count bigint)
language sql stable security definer set search_path = public as $$
  select y.id,
    (select count(*) from public.domains d where d.year_id = y.id and d.is_published),
    (select count(*) from public.units u join public.domains d on d.id = u.domain_id where d.year_id = y.id and d.is_published and u.is_published),
    (select count(*) from public.lessons l join public.units u on u.id = l.unit_id join public.domains d on d.id = u.domain_id
       where d.year_id = y.id and d.is_published and u.is_published and l.status = 'published')
  from public.academic_years y where y.is_published order by y.sort_order;
$$;

-- ===== المدفوعات: التأكيد والرفض للمدير فقط =====
create or replace function public.confirm_payment(pid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.payments; s timestamptz; sid uuid; d int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into p from public.payments where id = pid for update;
  if not found then raise exception 'payment not found'; end if;
  if p.status <> 'pending' then raise exception 'payment already %', p.status; end if;
  -- المدة من الدفعة نفسها (لقطة وقت الطلب)، وللدفعات القديمة من الإعدادات
  d := coalesce(p.duration_days, public.setting_int('subscription_days', 365));
  select greatest(now(), coalesce(max(ends_at), now())) into s
    from public.subscriptions where user_id = p.user_id and status = 'active';
  insert into public.subscriptions (user_id, status, starts_at, ends_at, payment_id)
    values (p.user_id, 'active', s, s + make_interval(days => d), p.id)
    returning id into sid;
  update public.payments set status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now() where id = p.id;
  return sid;
end $$;

create or replace function public.reject_payment(pid uuid, note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.payments set status = 'rejected', admin_note = note, reviewed_by = auth.uid(), reviewed_at = now()
    where id = pid and status = 'pending';
  if not found then raise exception 'payment not pending or not found'; end if;
end $$;

-- ===== إحصائيات المدير =====
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'active_subscriptions', (select count(distinct user_id) from public.subscriptions where status = 'active' and starts_at <= now() and ends_at > now()),
    'trial_students', (select count(*) from public.profiles p where p.role = 'student' and p.trial_ends_at > now()
        and not exists (select 1 from public.subscriptions s where s.user_id = p.id and s.status = 'active' and s.ends_at > now())),
    'expired_students', (select count(*) from public.profiles p where p.role = 'student' and p.trial_ends_at <= now()
        and not exists (select 1 from public.subscriptions s where s.user_id = p.id and s.status = 'active' and s.ends_at > now())),
    'expired_subscriptions', (select count(*) from public.subscriptions where ends_at <= now()),
    'revenue_da', (select coalesce(sum(amount_da), 0) from public.payments where status = 'confirmed'),
    'pending_payments', (select count(*) from public.payments where status = 'pending'),
    'top_lessons', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select l.id, l.title, count(*) as opens from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
        group by l.id, l.title order by opens desc limit 5) t),
    'top_years', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select y.id, y.title, count(*) as opens from public.lesson_progress lp
        join public.lessons l on l.id = lp.lesson_id join public.units u on u.id = l.unit_id
        join public.domains d on d.id = u.domain_id join public.academic_years y on y.id = d.year_id
        group by y.id, y.title order by opens desc limit 3) t)
  );
end $$;

-- المرحلة 6: تعليمات الدفع (قابلة للتعديل من لوحة الإدارة)
insert into public.app_settings (key, value)
values ('payment_instructions', to_jsonb('عدّل هذا النص من لوحة الإدارة > الإعدادات: اكتب هنا طريقة الدفع ورقم الحساب.'::text))
on conflict (key) do nothing;

-- ===== المرحلة 8: خطط الاشتراك القابلة للإدارة من لوحة المدير =====
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  price_da int not null check (price_da between 1 and 1000000),
  duration_days int not null check (duration_days between 1 and 3650),
  features text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plans_active_idx on public.plans (is_active, sort_order);
drop trigger if exists trg_updated_at on public.plans;
create trigger trg_updated_at before update on public.plans for each row execute function public.set_updated_at();

-- الدفعة تحفظ لقطة من الخطة وقت الطلب، فتعديل الخطة أو حذفها لا يغيّر طلبات قائمة
alter table public.payments add column if not exists plan_id uuid references public.plans(id) on delete set null;
alter table public.payments add column if not exists plan_name text;
alter table public.payments add column if not exists duration_days int check (duration_days is null or duration_days between 1 and 3650);

-- خطة افتراضية من الإعدادات القديمة (فقط إن لم توجد أي خطة)
insert into public.plans (name, price_da, duration_days, features, is_featured)
select 'الاشتراك السنوي', public.setting_int('annual_price_da', 2500), public.setting_int('subscription_days', 365),
  array['السنوات الثلاث بكل مجالاتها', 'كل الدروس والتحديثات', 'متابعة التقدم والمفضلة'], true
where not exists (select 1 from public.plans);

-- الأسعار العامة للزوار: الخطط المفعّلة ومدة التجربة فقط (دون كشف جدول الإعدادات)
create or replace function public.public_pricing() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trial_days', public.setting_int('trial_days', 7),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description,
        'price_da', p.price_da, 'duration_days', p.duration_days, 'features', to_jsonb(p.features), 'is_featured', p.is_featured)
        order by p.sort_order, p.created_at) from public.plans p where p.is_active), '[]'::jsonb));
$$;

-- ===== المرحلة 9: هوية الموقع (عامة للزوار: الاسم والشعار والنصوص وبيانات التواصل فقط) =====
create or replace function public.public_site() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_settings where key = 'site' and jsonb_typeof(value) = 'object'), '{}'::jsonb);
$$;
grant execute on function public.public_site() to anon, authenticated;
