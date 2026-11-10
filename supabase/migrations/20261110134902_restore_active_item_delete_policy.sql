create policy "authorized family devices can delete active purchase items"
  on public.purchase_items
  for delete to authenticated
  using (
    (select private.is_family_device_authorized())
    and exists (
      select 1
      from public.purchases purchase
      where purchase.id = purchase_items.purchase_id
        and purchase.status = 'active'
    )
  );