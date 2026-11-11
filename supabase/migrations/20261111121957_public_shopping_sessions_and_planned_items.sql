-- Public, isolated shopping sessions with persistent device membership.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role, authenticated;

create table if not exists private.shopping_session_pin_registry (
  pin text primary key check (pin ~ '^[A-Z0-9]{8}$' and pin ~ '[A-Z]' and pin ~ '[0-9]'),
  generated_at timestamptz not null default now()
);
alter table private.shopping_session_pin_registry enable row level security;
revoke all on private.shopping_session_pin_registry from public, anon, authenticated;
grant all on private.shopping_session_pin_registry to service_role;

create table if not exists private.shopping_sessions (
  id uuid primary key default gen_random_uuid(),
  pin text not null unique references private.shopping_session_pin_registry(pin),
  created_at timestamptz not null default now()
);
alter table private.shopping_sessions enable row level security;
revoke all on private.shopping_sessions from public, anon, authenticated;
grant all on private.shopping_sessions to service_role;

create table if not exists private.shopping_session_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null references private.shopping_sessions(id) on delete cascade,
  joined_at timestamptz not null default now()
);
create index if not exists shopping_session_members_session_idx on private.shopping_session_members(session_id);
alter table private.shopping_session_members enable row level security;
revoke all on private.shopping_session_members from public, anon, authenticated;
grant all on private.shopping_session_members to service_role;

create or replace function private.current_shopping_session_id()
returns uuid language sql stable security definer set search_path = pg_catalog
as $$
  select member.session_id from private.shopping_session_members member
  where member.user_id = (select auth.uid()) limit 1;
$$;
revoke all on function private.current_shopping_session_id() from public, anon;
grant execute on function private.current_shopping_session_id() to authenticated, service_role;

create or replace function private.is_shopping_session_member(p_session_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select p_session_id is not null and exists (
    select 1 from private.shopping_session_members member
    where member.user_id = (select auth.uid()) and member.session_id = p_session_id
  );
$$;
revoke all on function private.is_shopping_session_member(uuid) from public, anon;
grant execute on function private.is_shopping_session_member(uuid) to authenticated, service_role;

create table if not exists private.shopping_session_pin_attempts (
  id bigint generated always as identity primary key,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);
create index if not exists shopping_session_pin_attempts_fingerprint_time_idx
  on private.shopping_session_pin_attempts(fingerprint, attempted_at desc);
alter table private.shopping_session_pin_attempts enable row level security;
revoke all on private.shopping_session_pin_attempts from public, anon, authenticated;
grant all on private.shopping_session_pin_attempts to service_role;

-- Migrate the existing family devices and purchase into one shared session.
alter table public.purchases add column if not exists session_id uuid;
do $$
declare
  v_session_id uuid;
  v_pin text;
begin
  if exists (select 1 from private.family_devices) then
    loop
      v_pin := upper(substr(md5(gen_random_uuid()::text), 1, 8));
      exit when v_pin ~ '[A-Z]' and v_pin ~ '[0-9]'
        and not exists (select 1 from private.shopping_session_pin_registry where pin = v_pin);
    end loop;
    insert into private.shopping_session_pin_registry(pin) values (v_pin);
    insert into private.shopping_sessions(pin) values (v_pin) returning id into v_session_id;
    insert into private.shopping_session_members(user_id, session_id)
      select user_id, v_session_id from private.family_devices
      on conflict (user_id) do nothing;
    update public.purchases set session_id = v_session_id where session_id is null;
  elsif exists (select 1 from public.purchases) then
    raise exception 'Cannot migrate existing purchases without authorized family devices.';
  end if;
end;
$$;

alter table public.purchases alter column session_id set default private.current_shopping_session_id();
alter table public.purchases add constraint purchases_session_id_fkey
  foreign key (session_id) references private.shopping_sessions(id) on delete cascade;
alter table public.purchases alter column session_id set not null;
drop index if exists public.purchases_single_active_idx;
create unique index if not exists purchases_one_active_per_session_idx
  on public.purchases(session_id) where status = 'active';
create index if not exists purchases_session_created_at_idx on public.purchases(session_id, created_at desc);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null default private.current_shopping_session_id()
    references private.shopping_sessions(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  quantity_milli integer not null check (quantity_milli > 0),
  unit_price_cents integer check (unit_price_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'purchased')),
  added_by_name varchar(50) not null check (char_length(btrim(added_by_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  purchased_at timestamptz,
  constraint shopping_list_items_purchase_state_check check (
    (status = 'pending' and purchase_id is null and purchased_at is null)
    or (status = 'purchased' and purchase_id is not null and purchased_at is not null and unit_price_cents is not null)
  )
);
create index if not exists shopping_list_items_session_status_idx
  on public.shopping_list_items(session_id, status, created_at);
create index if not exists shopping_list_items_purchase_idx
  on public.shopping_list_items(purchase_id) where purchase_id is not null;
alter table public.shopping_list_items enable row level security;
revoke all on public.shopping_list_items from public, anon;
grant select, insert, update, delete on public.shopping_list_items to authenticated;
grant all on public.shopping_list_items to service_role;

create or replace function public.create_shopping_session(p_user_id uuid, p_pin text)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_session_id uuid;
begin
  if p_user_id is null or p_pin !~ '^[A-Z0-9]{8}$' or p_pin !~ '[A-Z]' or p_pin !~ '[0-9]' then
    raise exception 'Invalid session details';
  end if;
  if exists (select 1 from private.shopping_session_members where user_id = p_user_id) then
    raise exception 'DEVICE_ALREADY_IN_SESSION';
  end if;
  insert into private.shopping_session_pin_registry(pin) values (p_pin);
  insert into private.shopping_sessions(pin) values (p_pin) returning id into v_session_id;
  insert into private.shopping_session_members(user_id, session_id) values (p_user_id, v_session_id);
  return v_session_id;
end;
$$;

create or replace function public.join_shopping_session(p_user_id uuid, p_pin text)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v_session_id uuid;
begin
  if p_user_id is null then raise exception 'Missing device identity'; end if;
  if exists (select 1 from private.shopping_session_members where user_id = p_user_id) then
    raise exception 'DEVICE_ALREADY_IN_SESSION';
  end if;
  select id into v_session_id from private.shopping_sessions where pin = p_pin for update;
  if v_session_id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  insert into private.shopping_session_members(user_id, session_id) values (p_user_id, v_session_id);
  return v_session_id;
end;
$$;

create or replace function public.check_shopping_session(p_user_id uuid)
returns table(session_id uuid, pin text, member_count bigint)
language sql stable security definer set search_path = pg_catalog
as $$
  select session.id, session.pin,
    (select count(*) from private.shopping_session_members member_count where member_count.session_id = session.id)
  from private.shopping_session_members member
  join private.shopping_sessions session on session.id = member.session_id
  where member.user_id = p_user_id;
$$;

create or replace function public.leave_shopping_session(p_user_id uuid, p_confirm_end boolean)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare v_session_id uuid; v_member_count bigint;
begin
  select session_id into v_session_id from private.shopping_session_members where user_id = p_user_id;
  if v_session_id is null then raise exception 'DEVICE_NOT_IN_SESSION'; end if;
  perform 1 from private.shopping_sessions where id = v_session_id for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select count(*) into v_member_count from private.shopping_session_members where session_id = v_session_id;
  if v_member_count = 1 and not p_confirm_end then
    return jsonb_build_object('needsConfirmation', true, 'memberCount', 1, 'ended', false);
  end if;
  delete from private.shopping_session_members where user_id = p_user_id and session_id = v_session_id;
  select count(*) into v_member_count from private.shopping_session_members where session_id = v_session_id;
  if v_member_count = 0 then
    delete from private.shopping_sessions where id = v_session_id;
    return jsonb_build_object('needsConfirmation', false, 'memberCount', 0, 'ended', true);
  end if;
  return jsonb_build_object('needsConfirmation', false, 'memberCount', v_member_count, 'ended', false);
end;
$$;

create or replace function public.check_shopping_session_pin_attempt(
  p_device_fingerprint text, p_ip_fingerprint text, p_failed boolean
)
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
declare v_device_attempts integer; v_ip_attempts integer;
begin
  if p_device_fingerprint !~ '^[0-9a-f]{64}$' or p_ip_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid rate-limit fingerprint';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(p_device_fingerprint, p_ip_fingerprint), 0));
  if p_device_fingerprint <> p_ip_fingerprint then
    perform pg_advisory_xact_lock(hashtextextended(greatest(p_device_fingerprint, p_ip_fingerprint), 0));
  end if;
  delete from private.shopping_session_pin_attempts where attempted_at < now() - interval '1 day';
  select count(*) filter (where fingerprint = p_device_fingerprint)::integer,
         count(*) filter (where fingerprint = p_ip_fingerprint)::integer
    into v_device_attempts, v_ip_attempts
  from private.shopping_session_pin_attempts
  where fingerprint in (p_device_fingerprint, p_ip_fingerprint)
    and attempted_at > now() - interval '15 minutes';
  if v_device_attempts >= 5 or v_ip_attempts >= 5 then return false; end if;
  if p_failed then
    insert into private.shopping_session_pin_attempts(fingerprint) values (p_device_fingerprint)
    union all select p_ip_fingerprint where p_ip_fingerprint <> p_device_fingerprint;
  end if;
  return true;
end;
$$;

revoke all on function public.create_shopping_session(uuid, text) from public, anon, authenticated;
revoke all on function public.join_shopping_session(uuid, text) from public, anon, authenticated;
revoke all on function public.check_shopping_session(uuid) from public, anon, authenticated;
revoke all on function public.leave_shopping_session(uuid, boolean) from public, anon, authenticated;
revoke all on function public.check_shopping_session_pin_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_shopping_session(uuid, text) to service_role;
grant execute on function public.join_shopping_session(uuid, text) to service_role;
grant execute on function public.check_shopping_session(uuid) to service_role;
grant execute on function public.leave_shopping_session(uuid, boolean) to service_role;
grant execute on function public.check_shopping_session_pin_attempt(text, text, boolean) to service_role;

-- Replace all legacy global authorization policies with membership-based policies.
drop policy if exists "authorized family devices can read purchases" on public.purchases;
drop policy if exists "authorized family devices can create purchases" on public.purchases;
drop policy if exists "authorized family devices can update purchases" on public.purchases;
drop policy if exists "authorized family devices can delete purchases" on public.purchases;
drop policy if exists "authorized family devices can create active purchases" on public.purchases;
drop policy if exists "authorized family devices can complete active purchases" on public.purchases;
drop policy if exists "authorized family devices can read purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can create purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can update purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can delete purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can add items to active purchases" on public.purchase_items;
drop policy if exists "authorized family devices can edit items in active purchases" on public.purchase_items;
drop policy if exists "authorized family devices can delete active purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can read item edit history" on public.purchase_item_edit_history;

create policy "session members can read purchases" on public.purchases for select to authenticated
  using ((select private.is_shopping_session_member(session_id)));
create policy "session members can create active purchases" on public.purchases for insert to authenticated
  with check ((select private.is_shopping_session_member(session_id)) and status = 'active' and completed_at is null);
create policy "session members can complete active purchases" on public.purchases for update to authenticated
  using ((select private.is_shopping_session_member(session_id)) and status = 'active')
  with check ((select private.is_shopping_session_member(session_id)) and status in ('active', 'completed'));

create policy "session members can read purchase items" on public.purchase_items for select to authenticated
  using (exists (select 1 from public.purchases purchase where purchase.id = purchase_id
    and (select private.is_shopping_session_member(purchase.session_id))));
create policy "session members can add items to active purchases" on public.purchase_items for insert to authenticated
  with check (exists (select 1 from public.purchases purchase where purchase.id = purchase_id
    and purchase.status = 'active' and (select private.is_shopping_session_member(purchase.session_id))));
create policy "session members can edit items in active purchases" on public.purchase_items for update to authenticated
  using (exists (select 1 from public.purchases purchase where purchase.id = purchase_items.purchase_id
    and purchase.status = 'active' and (select private.is_shopping_session_member(purchase.session_id))))
  with check (exists (select 1 from public.purchases purchase where purchase.id = purchase_items.purchase_id
    and purchase.status = 'active' and (select private.is_shopping_session_member(purchase.session_id))));
create policy "session members can delete items in active purchases" on public.purchase_items for delete to authenticated
  using (exists (select 1 from public.purchases purchase where purchase.id = purchase_items.purchase_id
    and purchase.status = 'active' and (select private.is_shopping_session_member(purchase.session_id))));

create policy "session members can read item edit history" on public.purchase_item_edit_history for select to authenticated
  using (exists (
    select 1 from public.purchase_items item join public.purchases purchase on purchase.id = item.purchase_id
    where item.id = purchase_item_id and (select private.is_shopping_session_member(purchase.session_id))
  ));

create policy "session members can read planned shopping items" on public.shopping_list_items for select to authenticated
  using ((select private.is_shopping_session_member(session_id)));
create policy "session members can add planned shopping items" on public.shopping_list_items for insert to authenticated
  with check ((select private.is_shopping_session_member(session_id))
    and status = 'pending' and purchase_id is null and purchased_at is null);
create policy "session members can update planned shopping items" on public.shopping_list_items for update to authenticated
  using ((select private.is_shopping_session_member(session_id)) and status = 'pending')
  with check ((select private.is_shopping_session_member(session_id)) and (
    (status = 'pending' and purchase_id is null and purchased_at is null)
    or (status = 'purchased' and purchase_id is not null and purchased_at is not null and unit_price_cents is not null
      and exists (select 1 from public.purchases purchase where purchase.id = purchase_id
        and purchase.session_id = session_id and purchase.status = 'active'))
  ));
create policy "session members can delete pending shopping items" on public.shopping_list_items for delete to authenticated
  using ((select private.is_shopping_session_member(session_id)) and status = 'pending');

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'shopping_list_items') then
    alter publication supabase_realtime add table public.shopping_list_items;
  end if;
end;
$$;
