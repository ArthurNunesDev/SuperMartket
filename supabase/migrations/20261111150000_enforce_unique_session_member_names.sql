create unique index if not exists shopping_session_members_unique_display_name
on private.shopping_session_members (session_id, lower(btrim(display_name)))
where display_name is not null;

create or replace function public.set_shopping_session_member_name(
  p_user_id uuid,
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  normalized_name text := btrim(p_display_name);
begin
  if p_user_id is null then
    raise exception 'Missing device identity';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 50 then
    raise exception 'A valid member name is required';
  end if;

  begin
    update private.shopping_session_members
    set display_name = normalized_name
    where user_id = p_user_id;

    if not found then
      raise exception 'DEVICE_NOT_IN_SESSION';
    end if;
  exception
    when unique_violation then
      raise exception 'DUPLICATE_MEMBER_NAME' using errcode = '23505';
  end;

  return true;
end;
$$;

revoke all on function public.set_shopping_session_member_name(uuid, text) from public, anon, authenticated;
grant execute on function public.set_shopping_session_member_name(uuid, text) to service_role;
