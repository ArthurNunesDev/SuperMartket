drop policy if exists "authorized family devices can create purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can update purchase items" on public.purchase_items;
drop policy if exists "authorized family devices can create purchases" on public.purchases;
drop policy if exists "authorized family devices can update purchases" on public.purchases;

create policy "authorized family devices can create active purchases"
  on public.purchases
  for insert to authenticated
  with check (
    (select private.is_family_device_authorized())
    and status = 'active'
    and completed_at is null
  );

create policy "authorized family devices can complete active purchases"
  on public.purchases
  for update to authenticated
  using (
    (select private.is_family_device_authorized())
    and status = 'active'
  )
  with check (
    (select private.is_family_device_authorized())
    and status in ('active', 'completed')
  );

create policy "authorized family devices can add items to active purchases"
  on public.purchase_items
  for insert to authenticated
  with check (
    (select private.is_family_device_authorized())
    and exists (
      select 1
      from public.purchases purchase
      where purchase.id = purchase_id
        and purchase.status = 'active'
    )
  );

create policy "authorized family devices can edit items in active purchases"
  on public.purchase_items
  for update to authenticated
  using (
    (select private.is_family_device_authorized())
    and exists (
      select 1
      from public.purchases purchase
      where purchase.id = purchase_items.purchase_id
        and purchase.status = 'active'
    )
  )
  with check (
    (select private.is_family_device_authorized())
    and exists (
      select 1
      from public.purchases purchase
      where purchase.id = purchase_items.purchase_id
        and purchase.status = 'active'
    )
  );

revoke update on public.purchases from authenticated;
grant update (status, completed_at) on public.purchases to authenticated;

revoke update on public.purchase_items from authenticated;
grant update (name, quantity_milli, unit_price_cents) on public.purchase_items to authenticated;