create or replace function public.purchase_planned_shopping_item(
  p_item_id uuid, p_purchase_id uuid, p_unit_price_cents integer, p_buyer_name varchar
)
returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_item public.shopping_list_items%rowtype;
  v_session_id uuid;
  v_purchase_item_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_unit_price_cents is null or p_unit_price_cents < 0 then raise exception 'A valid price is required'; end if;
  if p_buyer_name is null or char_length(btrim(p_buyer_name)) not between 1 and 50 then
    raise exception 'A valid buyer name is required';
  end if;
  select * into v_item from public.shopping_list_items where id = p_item_id for update;
  if not found or v_item.status <> 'pending' then raise exception 'PLANNED_ITEM_NOT_AVAILABLE'; end if;
  v_session_id := v_item.session_id;
  if not exists (select 1 from private.shopping_session_members member
    where member.user_id = auth.uid() and member.session_id = v_session_id) then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;
  if not exists (select 1 from public.purchases purchase where purchase.id = p_purchase_id
    and purchase.session_id = v_session_id and purchase.status = 'active') then
    raise exception 'ACTIVE_PURCHASE_NOT_FOUND';
  end if;
  insert into public.purchase_items(purchase_id, name, quantity_milli, unit_price_cents, added_by_name)
  values (p_purchase_id, v_item.name, v_item.quantity_milli, p_unit_price_cents, btrim(p_buyer_name))
  returning id into v_purchase_item_id;
  update public.shopping_list_items set status = 'purchased', purchase_id = p_purchase_id,
    unit_price_cents = p_unit_price_cents, purchased_at = now()
  where id = p_item_id and status = 'pending';
  return v_purchase_item_id;
end;
$$;
revoke all on function public.purchase_planned_shopping_item(uuid, uuid, integer, varchar) from public, anon;
grant execute on function public.purchase_planned_shopping_item(uuid, uuid, integer, varchar) to authenticated, service_role;
