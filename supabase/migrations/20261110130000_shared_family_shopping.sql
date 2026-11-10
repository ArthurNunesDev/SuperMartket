-- Shared family shopping data and PIN authorization
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

create table if not exists private.family_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  authorized_at timestamptz not null default now()
);
alter table private.family_devices enable row level security;
revoke all on private.family_devices from public, anon, authenticated;
grant all on private.family_devices to service_role;

create table if not exists private.family_pin_attempts (
  id bigint generated always as identity primary key,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);
create index if not exists family_pin_attempts_fingerprint_time_idx
  on private.family_pin_attempts (fingerprint, attempted_at desc);
alter table private.family_pin_attempts enable row level security;
revoke all on private.family_pin_attempts from public, anon, authenticated;
grant all on private.family_pin_attempts to service_role;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint purchases_completion_state_check check (
    (status = 'active' and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);
create unique index if not exists purchases_single_active_idx
  on public.purchases ((status))
  where status = 'active';

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  quantity_milli integer not null check (quantity_milli > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  added_by_name varchar(50) not null check (char_length(btrim(added_by_name)) between 1 and 50),
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
revoke all on public.purchases, public.purchase_items from public, anon;
grant select, insert, update, delete on public.purchases, public.purchase_items to authenticated;
grant all on public.purchases, public.purchase_items to service_role;

create or replace function public.is_family_device_authorized()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from private.family_devices device
    where device.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_family_device_authorized() from public, anon;
grant execute on function public.is_family_device_authorized() to authenticated, service_role;

create policy "authorized family devices can read purchases"
  on public.purchases for select to authenticated
  using ((select public.is_family_device_authorized()));
create policy "authorized family devices can create purchases"
  on public.purchases for insert to authenticated
  with check ((select public.is_family_device_authorized()));
create policy "authorized family devices can update purchases"
  on public.purchases for update to authenticated
  using ((select public.is_family_device_authorized()))
  with check ((select public.is_family_device_authorized()));
create policy "authorized family devices can delete purchases"
  on public.purchases for delete to authenticated
  using ((select public.is_family_device_authorized()));

create policy "authorized family devices can read purchase items"
  on public.purchase_items for select to authenticated
  using ((select public.is_family_device_authorized()));
create policy "authorized family devices can create purchase items"
  on public.purchase_items for insert to authenticated
  with check ((select public.is_family_device_authorized()));
create policy "authorized family devices can update purchase items"
  on public.purchase_items for update to authenticated
  using ((select public.is_family_device_authorized()))
  with check ((select public.is_family_device_authorized()));
create policy "authorized family devices can delete purchase items"
  on public.purchase_items for delete to authenticated
  using ((select public.is_family_device_authorized()));

create or replace function public.check_family_pin_attempt(
  p_device_fingerprint text,
  p_ip_fingerprint text,
  p_failed boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  device_attempts integer;
  ip_attempts integer;
begin
  if p_device_fingerprint !~ '^[0-9a-f]{64}$'
     or p_ip_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit fingerprint';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(least(p_device_fingerprint, p_ip_fingerprint), 0)
  );
  if p_device_fingerprint <> p_ip_fingerprint then
    perform pg_advisory_xact_lock(
      hashtextextended(greatest(p_device_fingerprint, p_ip_fingerprint), 0)
    );
  end if;

  delete from private.family_pin_attempts
  where attempted_at < now() - interval '1 day';

  select
    count(*) filter (where fingerprint = p_device_fingerprint)::integer,
    count(*) filter (where fingerprint = p_ip_fingerprint)::integer
  into device_attempts, ip_attempts
  from private.family_pin_attempts
  where fingerprint in (p_device_fingerprint, p_ip_fingerprint)
    and attempted_at > now() - interval '15 minutes';

  if device_attempts >= 5 or ip_attempts >= 5 then
    return false;
  end if;

  if p_failed then
    insert into private.family_pin_attempts (fingerprint)
    values (p_device_fingerprint)
    union all
    select p_ip_fingerprint
    where p_ip_fingerprint <> p_device_fingerprint;
  end if;

  return true;
end;
$$;
revoke all on function public.check_family_pin_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.check_family_pin_attempt(text, text, boolean) to service_role;

create or replace function public.authorize_family_device(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;
  insert into private.family_devices (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
end;
$$;
revoke all on function public.authorize_family_device(uuid) from public, anon, authenticated;
grant execute on function public.authorize_family_device(uuid) to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchases'
    ) then
      alter publication supabase_realtime add table public.purchases;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchase_items'
    ) then
      alter publication supabase_realtime add table public.purchase_items;
    end if;
  end if;
end;
$$;

revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to postgres;
