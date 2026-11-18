-- المرحلة 8: خطط الاشتراك. شغّله مرة واحدة إن كنت قد شغّلت schema.sql وpolicies.sql سابقاً (آمن لإعادة التشغيل).

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

-- الأسعار العامة للزوار: الخطط المفعّلة ومدة التجربة فقط (دون كشف جدول الإعدادات)
create or replace function public.public_pricing() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'trial_days', public.setting_int('trial_days', 7),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'description', p.description,
        'price_da', p.price_da, 'duration_days', p.duration_days, 'features', to_jsonb(p.features), 'is_featured', p.is_featured)
        order by p.sort_order, p.created_at) from public.plans p where p.is_active), '[]'::jsonb));
$$;


-- ===== المرحلة 8: صلاحيات الخطط =====
alter table public.plans enable row level security;
revoke all on public.plans from anon;
drop policy if exists ca_admin_all on public.plans;
create policy ca_admin_all on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists ca_plans_read on public.plans;
create policy ca_plans_read on public.plans for select to authenticated using (is_active);
grant execute on function public.public_pricing() to anon, authenticated;

drop policy if exists ca_pay_insert on public.payments;
create policy ca_pay_insert on public.payments for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null and reviewed_at is null
    and admin_note is null
    and exists (select 1 from public.plans p where p.id = payments.plan_id and p.is_active
      and p.price_da = payments.amount_da and p.duration_days = payments.duration_days and p.name = payments.plan_name));
