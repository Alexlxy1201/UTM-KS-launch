create extension if not exists "pgcrypto";
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_master (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  flavor text,
  base_price numeric(10, 2) not null default 0,
  cost numeric(10, 2) not null default 0,
  default_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_menu (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null,
  meal_id uuid not null references public.menu_master(id) on delete cascade,
  today_price numeric(10, 2) not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (menu_date, meal_id)
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  full_name text not null,
  auth_email text not null unique,
  email text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles add column if not exists username text;
alter table public.user_profiles add column if not exists full_name text;
alter table public.user_profiles add column if not exists auth_email text;
alter table public.user_profiles add column if not exists email text;
alter table public.user_profiles add column if not exists phone text not null default '';
alter table public.user_profiles add column if not exists created_at timestamptz not null default now();
alter table public.user_profiles add column if not exists updated_at timestamptz not null default now();

update public.user_profiles
set username = coalesce(nullif(trim(username), ''), 'user_' || left(user_id::text, 6))
where username is null or trim(username) = '';

update public.user_profiles
set auth_email = coalesce(nullif(trim(auth_email), ''), email)
where auth_email is null or trim(auth_email) = '';

update public.user_profiles
set email = ''
where email is null;

alter table public.user_profiles alter column username set not null;
alter table public.user_profiles alter column auth_email set not null;
alter table public.user_profiles alter column email set default '';
alter table public.user_profiles alter column email set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_email_key'
  ) then
    alter table public.user_profiles drop constraint user_profiles_email_key;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_username_key'
  ) then
    alter table public.user_profiles add constraint user_profiles_username_key unique (username);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_profiles'::regclass
      and conname = 'user_profiles_auth_email_key'
  ) then
    alter table public.user_profiles add constraint user_profiles_auth_email_key unique (auth_email);
  end if;
end;
$$;

create table if not exists public.admin_users (
  email text not null,
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_users add column if not exists email text;
alter table public.admin_users add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.admin_users add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_pkey'
  ) then
    alter table public.admin_users drop constraint admin_users_pkey;
  end if;
end;
$$;

alter table public.admin_users alter column user_id drop not null;
alter table public.admin_users alter column email set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_pkey'
  ) then
    alter table public.admin_users add constraint admin_users_pkey primary key (email);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'admin_users_user_id_key'
  ) then
    alter table public.admin_users add constraint admin_users_user_id_key unique (user_id);
  end if;
end;
$$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_no text not null unique,
  customer_name text not null,
  ordered_at timestamptz not null default now(),
  order_date date not null default (timezone('Asia/Shanghai', now()))::date,
  payment_channel text,
  payment_status text not null default '未付',
  payment_proof_path text,
  payment_note text,
  callback_time timestamptz
);

alter table public.orders add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists ordered_at timestamptz not null default now();
alter table public.orders add column if not exists order_date date not null default (timezone('Asia/Shanghai', now()))::date;
alter table public.orders add column if not exists payment_channel text;
alter table public.orders add column if not exists payment_status text not null default '未付';
alter table public.orders add column if not exists payment_proof_path text;
alter table public.orders add column if not exists payment_note text;
alter table public.orders add column if not exists callback_time timestamptz;
alter table public.orders alter column payment_status set default '未付';

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  meal_id uuid references public.menu_master(id),
  meal_name text not null,
  unit_price numeric(10, 2) not null default 0,
  meal_cost numeric(10, 2) not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_no text not null,
  customer_name text not null,
  payment_channel text not null,
  proof_path text not null,
  uploaded_at timestamptz not null default now(),
  status text not null default '待核验'
);

alter table public.payments alter column status set default '待核验';

create table if not exists public.daily_stats (
  stat_date date primary key,
  total_sold numeric(10, 2) not null default 0,
  total_cost numeric(10, 2) not null default 0,
  total_profit numeric(10, 2) not null default 0,
  paid_orders integer not null default 0,
  note text,
  updated_at timestamptz not null default now()
);

update public.orders
set payment_status = case payment_status
  when '鏈粯' then '未付'
  when '寰呮牳楠?' then '待核验'
  when '宸蹭粯' then '已付'
  when '閺堫亙绮?' then '未付'
  when '瀵板懏鐗虫?' then '待核验'
  when '瀹歌弓绮?' then '已付'
  else payment_status
end;

update public.orders
set payment_channel = case payment_channel
  when '鏀粯瀹?' then '支付宝'
  when '寰俊' then '微信'
  when '閺€顖欑帛鐎?' then '支付宝'
  when '瀵邦喕淇?' then '微信'
  else payment_channel
end;

update public.payments
set status = case status
  when '鏈粯' then '未付'
  when '寰呮牳楠?' then '待核验'
  when '宸蹭粯' then '已付'
  when '閺堫亙绮?' then '未付'
  when '瀵板懏鐗虫?' then '待核验'
  when '瀹歌弓绮?' then '已付'
  else status
end,
payment_channel = case payment_channel
  when '鏀粯瀹?' then '支付宝'
  when '寰俊' then '微信'
  when '閺€顖欑帛鐎?' then '支付宝'
  when '瀵邦喕淇?' then '微信'
  else payment_channel
end;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_profile_updated_at();

create or replace function public.sync_auth_user_to_public()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_full_name text;
  v_phone text;
  v_profile_email text;
begin
  v_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  v_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_profile_email := nullif(trim(coalesce(new.raw_user_meta_data ->> 'profile_email', new.raw_user_meta_data ->> 'email', '')), '');

  insert into public.user_profiles (
    user_id,
    username,
    full_name,
    auth_email,
    email,
    phone
  )
  values (
    new.id,
    coalesce(v_username, 'user_' || left(new.id::text, 6)),
    coalesce(v_full_name, split_part(coalesce(v_profile_email, new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    coalesce(v_profile_email, ''),
    coalesce(v_phone, '')
  )
  on conflict (user_id) do update
  set
    username = case
      when excluded.username is not null and excluded.username <> '' then excluded.username
      else public.user_profiles.username
    end,
    full_name = case
      when excluded.full_name is not null and excluded.full_name <> '' then excluded.full_name
      else public.user_profiles.full_name
    end,
    auth_email = excluded.auth_email,
    email = case
      when excluded.email is not null then excluded.email
      else public.user_profiles.email
    end,
    phone = case
      when excluded.phone is not null and excluded.phone <> '' then excluded.phone
      else public.user_profiles.phone
    end,
    updated_at = now();

  update public.admin_users
  set user_id = new.id
  where lower(email) = lower(coalesce(new.email, ''));

  return new;
end;
$$;

drop trigger if exists trg_sync_auth_user_to_public on auth.users;
create trigger trg_sync_auth_user_to_public
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.sync_auth_user_to_public();

insert into public.user_profiles (user_id, username, full_name, auth_email, email, phone)
select
  au.id,
  coalesce(
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'username', '')), ''),
    'user_' || left(au.id::text, 6)
  ),
  coalesce(
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'full_name', '')), ''),
    split_part(
      coalesce(
        nullif(trim(coalesce(au.raw_user_meta_data ->> 'profile_email', au.raw_user_meta_data ->> 'email', '')), ''),
        au.email,
        ''
      ),
      '@',
      1
    )
  ),
  coalesce(
    nullif(trim(coalesce(au.raw_user_meta_data ->> 'profile_email', au.raw_user_meta_data ->> 'email', '')), ''),
    ''
  ),
  coalesce(au.email, ''),
  coalesce(nullif(trim(coalesce(au.raw_user_meta_data ->> 'phone', '')), ''), '')
from auth.users au
on conflict (user_id) do update
set
  username = excluded.username,
  full_name = excluded.full_name,
  auth_email = excluded.auth_email,
  email = excluded.email,
  phone = excluded.phone,
  updated_at = now();

insert into public.admin_users (email)
values ('admin@example.com')
on conflict (email) do nothing;

update public.admin_users au
set user_id = auth_user.id
from auth.users auth_user
where lower(au.email) = lower(auth_user.email)
  and (au.user_id is null or au.user_id <> auth_user.id);

create or replace function public.resolve_login_email(p_login text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select up.auth_email
  from public.user_profiles up
  where lower(up.username) = lower(trim(p_login))
     or lower(up.auth_email) = lower(trim(p_login))
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
       or user_id = auth.uid()
  );
$$;

create or replace function public.refresh_daily_stats(
  p_stat_date date default (timezone('Asia/Shanghai', now()))::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_sold numeric(10, 2) := 0;
  v_total_cost numeric(10, 2) := 0;
  v_total_profit numeric(10, 2) := 0;
  v_paid_orders integer := 0;
  v_existing_note text := null;
begin
  select
    coalesce(sum(oi.unit_price), 0),
    coalesce(sum(oi.meal_cost), 0),
    coalesce(sum(oi.unit_price - oi.meal_cost), 0),
    count(distinct o.id)
  into v_total_sold, v_total_cost, v_total_profit, v_paid_orders
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.order_date = p_stat_date
    and o.payment_status = '已付';

  select ds.note
  into v_existing_note
  from public.daily_stats ds
  where ds.stat_date = p_stat_date;

  insert into public.daily_stats (
    stat_date,
    total_sold,
    total_cost,
    total_profit,
    paid_orders,
    note,
    updated_at
  )
  values (
    p_stat_date,
    v_total_sold,
    v_total_cost,
    v_total_profit,
    v_paid_orders,
    coalesce(v_existing_note, '自动汇总'),
    now()
  )
  on conflict (stat_date) do update
  set
    total_sold = excluded.total_sold,
    total_cost = excluded.total_cost,
    total_profit = excluded.total_profit,
    paid_orders = excluded.paid_orders,
    note = coalesce(public.daily_stats.note, excluded.note),
    updated_at = now();
end;
$$;

create or replace function public.sync_daily_stats_from_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_daily_stats(old.order_date);
    return old;
  end if;

  perform public.refresh_daily_stats(new.order_date);

  if tg_op = 'UPDATE' and old.order_date <> new.order_date then
    perform public.refresh_daily_stats(old.order_date);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_daily_stats_on_orders on public.orders;
create trigger trg_sync_daily_stats_on_orders
after update of payment_status, order_date or delete on public.orders
for each row
execute function public.sync_daily_stats_from_orders();

create or replace function public.sync_payment_rows_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments
  set status = new.payment_status
  where order_id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_sync_payment_rows_from_order on public.orders;
create trigger trg_sync_payment_rows_from_order
after update of payment_status on public.orders
for each row
execute function public.sync_payment_rows_from_order();

create or replace function public.generate_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'M'
    || to_char(now() at time zone 'Asia/Shanghai', 'YYYYMMDDHH24MISS')
    || lpad(floor(random() * 1000)::text, 3, '0');
end;
$$;

create or replace function public.create_order_with_items(p_meal_ids uuid[])
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_order_id uuid;
  v_order_no text;
  v_inserted_count integer;
  v_deadline_hour integer := 13;
  v_local_hour integer;
  v_order_date date := (timezone('Asia/Shanghai', now()))::date;
begin
  if v_user_id is null then
    raise exception '请先登录后再下单';
  end if;

  if coalesce(array_length(p_meal_ids, 1), 0) = 0 then
    raise exception '请至少选择一份餐点';
  end if;

  select *
  into v_profile
  from public.user_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile.user_id is null then
    raise exception '未找到用户资料，请重新登录后再试';
  end if;

  select value::integer
  into v_deadline_hour
  from public.app_config
  where key = 'ORDER_DEADLINE_HOUR'
  limit 1;

  v_deadline_hour := coalesce(v_deadline_hour, 13);
  v_local_hour := extract(hour from timezone('Asia/Shanghai', now()));

  if v_local_hour >= v_deadline_hour then
    raise exception '已过今日截单时间';
  end if;

  v_order_no := public.generate_order_no();

  insert into public.orders (
    user_id,
    order_no,
    customer_name,
    order_date
  )
  values (
    v_user_id,
    v_order_no,
    v_profile.full_name,
    v_order_date
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    meal_id,
    meal_name,
    unit_price,
    meal_cost
  )
  select
    v_order_id,
    mm.id,
    mm.name,
    coalesce(dm.today_price, mm.base_price),
    mm.cost
  from public.menu_master mm
  left join public.daily_menu dm
    on dm.meal_id = mm.id
   and dm.menu_date = v_order_date
  where mm.id = any(p_meal_ids)
    and coalesce(dm.is_available, mm.default_enabled) = true;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    delete from public.orders where id = v_order_id;
    raise exception '今日菜单中未找到可用餐点';
  end if;

  return json_build_object(
    'order_id', v_order_id,
    'order_no', v_order_no,
    'customer_name', v_profile.full_name
  );
end;
$$;

create or replace function public.register_payment(
  p_order_no text,
  p_payment_channel text,
  p_proof_path text,
  p_payment_note text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_auto_mark_paid boolean := true;
  v_status text := '待核验';
begin
  if v_user_id is null then
    raise exception '请先登录后再上传付款截图';
  end if;

  select *
  into v_order
  from public.orders
  where order_no = trim(p_order_no)
    and (
      user_id = v_user_id
      or public.is_admin()
    )
  limit 1;

  if v_order.id is null then
    raise exception '未找到匹配订单';
  end if;

  select case
    when lower(value) in ('1', 'true', 'yes', 'on') then true
    else false
  end
  into v_auto_mark_paid
  from public.app_config
  where key = 'AUTO_MARK_PAID'
  limit 1;

  v_auto_mark_paid := coalesce(v_auto_mark_paid, true);

  if v_auto_mark_paid then
    v_status := '已付';
  end if;

  insert into public.payments (
    order_id,
    order_no,
    customer_name,
    payment_channel,
    proof_path,
    status
  )
  values (
    v_order.id,
    v_order.order_no,
    v_order.customer_name,
    p_payment_channel,
    p_proof_path,
    v_status
  );

  update public.orders
  set
    payment_channel = p_payment_channel,
    payment_status = v_status,
    payment_proof_path = p_proof_path,
    payment_note = nullif(trim(coalesce(p_payment_note, '')), ''),
    callback_time = case when v_status = '已付' then now() else callback_time end
  where id = v_order.id;

  perform public.refresh_daily_stats(v_order.order_date);

  return json_build_object(
    'order_id', v_order.id,
    'order_no', v_order.order_no,
    'payment_status', v_status
  );
end;
$$;

create or replace function public.install_exchange_rate_sync_job(
  p_project_ref text,
  p_anon_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
  v_project_ref text := trim(coalesce(p_project_ref, ''));
  v_anon_key text := trim(coalesce(p_anon_key, ''));
  v_url text;
begin
  if v_project_ref = '' then
    raise exception 'Project ref is required.';
  end if;

  if v_anon_key = '' then
    raise exception 'Anon key is required.';
  end if;

  v_url := format('https://%s.functions.supabase.co/sync-exchange-rate', v_project_ref);

  for v_job_id in
    select jobid
    from cron.job
    where jobname in ('sync-exchange-rate-8am', 'sync-exchange-rate-daily')
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  -- Asia/Shanghai 00:00 equals UTC 16:00 on the previous day.
  perform cron.schedule(
    'sync-exchange-rate-daily',
    '0 16 * * *',
    format(
      $job$
        select
          net.http_post(
            url := %L,
            headers := %L::jsonb,
            body := '{}'::jsonb
          ) as request_id;
      $job$,
      v_url,
      json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key,
        'apikey', v_anon_key
      )::text
    )
  );
end;
$$;

create or replace function public.remove_exchange_rate_sync_job()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname in ('sync-exchange-rate-8am', 'sync-exchange-rate-daily')
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

insert into public.app_config (key, value, is_public)
values
  ('ORDER_DEADLINE_HOUR', '13', true),
  ('RM_TO_CNY', '1.7', true),
  ('RM_TO_CNY_SOURCE', '自动汇率服务', true),
  ('RM_TO_CNY_UPDATED_AT', '', true),
  ('RM_TO_CNY_AUTO_UPDATE_HOUR', '0', true),
  ('AUTO_MARK_PAID', 'true', true),
  ('QR_NOTE', '支付成功后上传截图即可登记订单。', true),
  ('LAUNCH_BUDGET', '低成本上线', true)
on conflict (key) do update
set
  value = excluded.value,
  is_public = excluded.is_public,
  updated_at = now();

insert into public.menu_master (
  id,
  name,
  category,
  flavor,
  base_price,
  cost,
  default_enabled
)
values
  ('11111111-1111-4111-8111-111111111111', '香煎鸡腿饭', '招牌饭盒', '微辣', 13, 7.8, true),
  ('22222222-2222-4222-8222-222222222222', '卤肉双拼饭', '热销主食', '经典', 14, 8.6, true),
  ('33333333-3333-4333-8333-333333333333', '黑椒牛柳意面', '西式便当', '浓香', 15, 9.2, true),
  ('44444444-4444-4444-8444-444444444444', '轻食鸡胸沙拉', '轻食系列', '清爽', 12, 6.4, true),
  ('55555555-5555-4555-8555-555555555555', '照烧鸡排饭', '热销主食', '咸甜', 14, 8.1, true),
  ('66666666-6666-4666-8666-666666666666', '麻婆豆腐饭', '家常快餐', '重辣', 11, 5.3, true)
on conflict (id) do update
set
  name = excluded.name,
  category = excluded.category,
  flavor = excluded.flavor,
  base_price = excluded.base_price,
  cost = excluded.cost,
  default_enabled = excluded.default_enabled;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-qrs', 'payment-qrs', true)
on conflict (id) do nothing;

alter table public.app_config enable row level security;
alter table public.menu_master enable row level security;
alter table public.daily_menu enable row level security;
alter table public.user_profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.daily_stats enable row level security;

drop policy if exists "public can read public config" on public.app_config;
create policy "public can read public config"
on public.app_config
for select
to anon, authenticated
using (is_public = true or public.is_admin());

drop policy if exists "admin can manage config" on public.app_config;
create policy "admin can manage config"
on public.app_config
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public can read menu master" on public.menu_master;
create policy "public can read menu master"
on public.menu_master
for select
to anon, authenticated
using (true);

drop policy if exists "admin can manage menu master" on public.menu_master;
create policy "admin can manage menu master"
on public.menu_master
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public can read daily menu" on public.daily_menu;
create policy "public can read daily menu"
on public.daily_menu
for select
to anon, authenticated
using (true);

drop policy if exists "admin can manage daily menu" on public.daily_menu;
create policy "admin can manage daily menu"
on public.daily_menu
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users can read own profile" on public.user_profiles;
create policy "users can read own profile"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users can insert own profile" on public.user_profiles;
create policy "users can insert own profile"
on public.user_profiles
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "users can update own profile" on public.user_profiles;
create policy "users can update own profile"
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin can read admin users" on public.admin_users;
create policy "admin can read admin users"
on public.admin_users
for select
to authenticated
using (public.is_admin());

drop policy if exists "admin can manage admin users" on public.admin_users;
create policy "admin can manage admin users"
on public.admin_users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users can read own orders" on public.orders;
create policy "users can read own orders"
on public.orders
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admin can update orders" on public.orders;
create policy "admin can update orders"
on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin can delete orders" on public.orders;
create policy "admin can delete orders"
on public.orders
for delete
to authenticated
using (public.is_admin());

drop policy if exists "users can read own order items" on public.order_items;
create policy "users can read own order items"
on public.order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "admin can manage order items" on public.order_items;
create policy "admin can manage order items"
on public.order_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "users can read own payments" on public.payments;
create policy "users can read own payments"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id
      and (o.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "admin can manage payments" on public.payments;
create policy "admin can manage payments"
on public.payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public can read daily stats" on public.daily_stats;
create policy "public can read daily stats"
on public.daily_stats
for select
to anon, authenticated
using (true);

drop policy if exists "admin can manage daily stats" on public.daily_stats;
create policy "admin can manage daily stats"
on public.daily_stats
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated users can upload own payment proofs" on storage.objects;
drop policy if exists "owners or admins can read payment proofs" on storage.objects;
drop policy if exists "admin can delete any payment proof" on storage.objects;

create policy "authenticated users can upload own payment proofs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "owners or admins can read payment proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

create policy "admin can delete any payment proof"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin()
);

drop policy if exists "public can read payment qrs" on storage.objects;
drop policy if exists "admin can upload payment qrs" on storage.objects;
drop policy if exists "admin can update payment qrs" on storage.objects;
drop policy if exists "admin can delete payment qrs" on storage.objects;

create policy "public can read payment qrs"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'payment-qrs');

create policy "admin can upload payment qrs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-qrs'
  and public.is_admin()
);

create policy "admin can update payment qrs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-qrs'
  and public.is_admin()
)
with check (
  bucket_id = 'payment-qrs'
  and public.is_admin()
);

create policy "admin can delete payment qrs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-qrs'
  and public.is_admin()
);

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
grant execute on function public.create_order_with_items(uuid[]) to authenticated;
grant execute on function public.register_payment(text, text, text, text) to authenticated;

insert into public.app_config (key, value, is_public)
values
  ('ALIPAY_QR_URL', '', true),
  ('WECHAT_QR_URL', '', true)
on conflict (key) do update
set
  is_public = excluded.is_public,
  updated_at = now();
