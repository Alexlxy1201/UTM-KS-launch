create extension if not exists "pgcrypto";

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

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_name text not null,
  ordered_at timestamptz not null default now(),
  order_date date not null default current_date,
  payment_channel text,
  payment_status text not null default '未付',
  payment_proof_path text,
  payment_note text,
  callback_time timestamptz
);

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

create table if not exists public.daily_stats (
  stat_date date primary key,
  total_sold numeric(10, 2) not null default 0,
  total_cost numeric(10, 2) not null default 0,
  total_profit numeric(10, 2) not null default 0,
  paid_orders integer not null default 0,
  note text,
  updated_at timestamptz not null default now()
);

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
    where user_id = auth.uid()
  );
$$;

create or replace function public.refresh_daily_stats(p_stat_date date default current_date)
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
    '自动汇总',
    now()
  )
  on conflict (stat_date) do update set
    total_sold = excluded.total_sold,
    total_cost = excluded.total_cost,
    total_profit = excluded.total_profit,
    paid_orders = excluded.paid_orders,
    note = excluded.note,
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

create or replace function public.create_order_with_items(
  p_customer_name text,
  p_meal_ids uuid[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_inserted_count integer;
  v_deadline_hour integer := 13;
  v_local_hour integer;
begin
  if trim(coalesce(p_customer_name, '')) = '' then
    raise exception '姓名不能为空';
  end if;

  if coalesce(array_length(p_meal_ids, 1), 0) = 0 then
    raise exception '请至少选择一份餐点';
  end if;

  select coalesce(value::integer, 13)
  into v_deadline_hour
  from public.app_config
  where key = 'ORDER_DEADLINE_HOUR';

  v_local_hour := extract(hour from timezone('Asia/Shanghai', now()));
  if v_local_hour >= v_deadline_hour then
    raise exception '已过今日截单时间';
  end if;

  v_order_no := public.generate_order_no();

  insert into public.orders (
    order_no,
    customer_name,
    order_date
  )
  values (
    v_order_no,
    trim(p_customer_name),
    current_date
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
   and dm.menu_date = current_date
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
    'customer_name', trim(p_customer_name)
  );
end;
$$;

create or replace function public.get_orders_by_name(
  p_customer_name text,
  p_order_date date default current_date
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce((
    select json_agg(
      json_build_object(
        'id', o.id,
        'order_no', o.order_no,
        'customer_name', o.customer_name,
        'ordered_at', o.ordered_at,
        'order_date', o.order_date,
        'payment_channel', o.payment_channel,
        'payment_status', o.payment_status,
        'payment_proof_path', o.payment_proof_path,
        'payment_note', o.payment_note,
        'callback_time', o.callback_time,
        'order_items', (
          select json_agg(
            json_build_object(
              'meal_id', oi.meal_id,
              'meal_name', oi.meal_name,
              'unit_price', oi.unit_price,
              'meal_cost', oi.meal_cost
            )
          )
          from public.order_items oi
          where oi.order_id = o.id
        )
      )
      order by o.ordered_at desc
    )
    from public.orders o
    where o.customer_name = trim(p_customer_name)
      and o.order_date = p_order_date
  ), '[]'::json);
end;
$$;

create or replace function public.register_payment(
  p_order_no text,
  p_customer_name text,
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
  v_order public.orders%rowtype;
  v_auto_mark_paid boolean := true;
  v_status text := '待核验';
begin
  select *
  into v_order
  from public.orders
  where order_no = trim(p_order_no)
    and customer_name = trim(p_customer_name)
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
  where key = 'AUTO_MARK_PAID';

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
    payment_note = p_payment_note,
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

insert into public.app_config (key, value, is_public)
values
  ('ORDER_DEADLINE_HOUR', '13', true),
  ('RM_TO_CNY', '1.7', true),
  ('AUTO_MARK_PAID', 'true', true),
  ('QR_NOTE', '支付成功后上传截图即可自动登记。', true),
  ('LAUNCH_BUDGET', '0 - 20 美元 / 月', true)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

alter table public.app_config enable row level security;
alter table public.menu_master enable row level security;
alter table public.daily_menu enable row level security;
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

drop policy if exists "admin can read orders" on public.orders;
create policy "admin can read orders"
on public.orders
for select
to authenticated
using (public.is_admin());

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

drop policy if exists "admin can read order items" on public.order_items;
create policy "admin can read order items"
on public.order_items
for select
to authenticated
using (public.is_admin());

drop policy if exists "admin can manage order items" on public.order_items;
create policy "admin can manage order items"
on public.order_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin can read payments" on public.payments;
create policy "admin can read payments"
on public.payments
for select
to authenticated
using (public.is_admin());

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

drop policy if exists "public can upload payment proofs" on storage.objects;
create policy "public can upload payment proofs"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'payment-proofs');

drop policy if exists "admin can read payment proofs" on storage.objects;
create policy "admin can read payment proofs"
on storage.objects
for select
to authenticated
using (bucket_id = 'payment-proofs' and public.is_admin());

drop policy if exists "admin can delete payment proofs" on storage.objects;
create policy "admin can delete payment proofs"
on storage.objects
for delete
to authenticated
using (bucket_id = 'payment-proofs' and public.is_admin());

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.create_order_with_items(text, uuid[]) to anon, authenticated;
grant execute on function public.get_orders_by_name(text, date) to anon, authenticated;
grant execute on function public.register_payment(text, text, text, text, text) to anon, authenticated;
