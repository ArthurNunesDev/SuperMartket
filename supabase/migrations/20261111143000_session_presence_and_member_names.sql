alter table private.shopping_session_members
  add column if not exists display_name varchar(50)
  check (display_name is null or char_length(btrim(display_name)) between 1 and 50);

create or replace function public.set_shopping_session_member_name(
  p_user_id uuid,
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_user_id is null then
    raise exception 'Missing device identity';
  end if;
  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 50 then
    raise exception 'A valid member name is required';
  end if;

  update private.shopping_session_members
  set display_name = btrim(p_display_name)
  where user_id = p_user_id;

  if not found then
    raise exception 'DEVICE_NOT_IN_SESSION';
  end if;
  return true;
end;
$$;

create or replace function public.list_shopping_session_members(p_user_id uuid)
returns table(user_id uuid, display_name varchar(50), joined_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select member.user_id, member.display_name, member.joined_at
  from private.shopping_session_members member
  where member.session_id = (
    select current_member.session_id
    from private.shopping_session_members current_member
    where current_member.user_id = p_user_id
  )
  order by member.joined_at asc;
$$;

revoke all on function public.set_shopping_session_member_name(uuid, text) from public, anon, authenticated;
revoke all on function public.list_shopping_session_members(uuid) from public, anon, authenticated;
grant execute on function public.set_shopping_session_member_name(uuid, text) to service_role;
grant execute on function public.list_shopping_session_members(uuid) to service_role;

drop policy if exists "session members can read activity messages" on realtime.messages;
drop policy if exists "session members can send activity messages" on realtime.messages;

create policy "session members can read activity messages"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select private.current_shopping_session_id()) is not null
  and (select realtime.topic()) = 'session:' || (select private.current_shopping_session_id())::text
);

create policy "session members can send activity messages"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select private.current_shopping_session_id()) is not null
  and (select realtime.topic()) = 'session:' || (select private.current_shopping_session_id())::text
);


drop policy if exists "session members can read purchase activity channel" on realtime.messages;
create policy "session members can read purchase activity channel"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select private.current_shopping_session_id()) is not null
  and (select realtime.topic()) = 'session:' || (select private.current_shopping_session_id())::text
);
