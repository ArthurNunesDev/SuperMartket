create or replace function public.update_planned_shopping_item(
  p_item_id uuid,
  p_name text,
  p_quantity_milli integer,
  p_unit_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_session_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'A valid item name is required';
  end if;
  if p_quantity_milli is null or p_quantity_milli < 1 then
    raise exception 'A valid item quantity is required';
  end if;
  if p_unit_price_cents is not null and p_unit_price_cents < 0 then
    raise exception 'A valid item price is required';
  end if;

  select item.session_id, item.status
    into v_session_id, v_status
  from public.shopping_list_items item
  where item.id = p_item_id
  for update;

  if not found or v_status <> 'pending' then
    raise exception 'PLANNED_ITEM_NOT_AVAILABLE';
  end if;
  if not exists (
    select 1
    from private.shopping_session_members member
    where member.user_id = auth.uid()
      and member.session_id = v_session_id
  ) then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  update public.shopping_list_items
  set name = btrim(p_name),
      quantity_milli = p_quantity_milli,
      unit_price_cents = p_unit_price_cents
  where id = p_item_id
    and status = 'pending';

  return p_item_id;
end;
$$;

revoke all on function public.update_planned_shopping_item(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.update_planned_shopping_item(uuid, text, integer, integer)
  to authenticated, service_role;
