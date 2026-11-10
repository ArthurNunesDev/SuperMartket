drop policy if exists "authorized family devices can read purchases" on public.purchases;
drop policy if exists "authorized family devices can create purchases" on public.purchases;
drop policy if exists "authorized family devices can update purchases" on public.purchases;
drop policy if exists "authorized family devices can delete purchases" on public.purchases;
drop policy if exists "authorized family devices can read purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can create purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can update purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can delete purchase items" on public.purchase_items;

drop function if exists public.is_family_device_authorized();

create or replace function private.is_family_device_authorized()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from private.family_devices device
    where device.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_family_device_authorized() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_family_device_authorized() to authenticated, service_role;

create policy "authorized family devices can read purchases"
  on public.purchases for select to authenticated
  using ((select private.is_family_device_authorized()));
create policy "authorized family devices can create purchases"
  on public.purchases for insert to authenticated
  with check ((select private.is_family_device_authorized()));
create policy "authorized family devices can update purchases"
  on public.purchases for update to authenticated
  using ((select private.is_family_device_authorized()))
  with check ((select private.is_family_device_authorized()));
create policy "authorized family devices can delete purchases"
  on public.purchases for delete to authenticated
  using ((select private.is_family_device_authorized()));

create policy "authorized family devices can read purchase items"
  on public.purchase_items for select to authenticated
  using ((select private.is_family_device_authorized()));
create policy "authorized family devices can create purchase items"
  on public.purchase_items for insert to authenticated
  with check ((select private.is_family_device_authorized()));
create policy "authorized family devices can update purchase items"
  on public.purchase_items for update to authenticated
  using ((select private.is_family_device_authorized()))
  with check ((select private.is_family_device_authorized()));