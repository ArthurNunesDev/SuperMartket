-- Require a fresh family PIN after each app load.
-- The Edge Function invokes this only with the service_role client.
create or replace function public.revoke_family_device(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  delete from private.family_devices
  where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_family_device(uuid) from public, anon, authenticated;
grant execute on function public.revoke_family_device(uuid) to service_role;
