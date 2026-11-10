create or replace function public.family_device_is_authorized(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from private.family_devices device
    where device.user_id = p_user_id
  );
$$;
revoke all on function public.family_device_is_authorized(uuid) from public, anon, authenticated;
grant execute on function public.family_device_is_authorized(uuid) to service_role;