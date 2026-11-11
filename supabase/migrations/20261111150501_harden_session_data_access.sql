-- Harden session-scoped writes and remove dangerous table privileges.
begin;

-- RLS does not apply to TRUNCATE. Authenticated anonymous devices must never
-- receive DDL-adjacent or bulk-bypass privileges on application tables.
revoke all on table
  public.purchases,
  public.purchase_items,
  public.shopping_list_items,
  public.purchase_item_edit_history
from public, anon, authenticated;

grant select on public.purchases, public.purchase_items, public.shopping_list_items,
  public.purchase_item_edit_history to authenticated;

grant insert (status) on public.purchases to authenticated;
grant update (status, completed_at) on public.purchases to authenticated;

grant insert (id, purchase_id, name, quantity_milli, unit_price_cents)
  on public.purchase_items to authenticated;
grant update (name, quantity_milli, unit_price_cents)
  on public.purchase_items to authenticated;
grant delete on public.purchase_items to authenticated;

grant insert (name, quantity_milli, unit_price_cents)
  on public.shopping_list_items to authenticated;
grant delete on public.shopping_list_items to authenticated;

revoke truncate, references, trigger on table
  public.purchases,
  public.purchase_items,
  public.shopping_list_items,
  public.purchase_item_edit_history
from public, anon, authenticated;

-- Actor names are derived from the authenticated device's session membership,
-- never trusted from browser-supplied added_by_name / edited_by_name fields.
create or replace function public.enforce_session_item_actor()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if tg_table_name = 'purchase_items' then
    select member.display_name
      into actor_name
    from private.shopping_session_members member
    join public.purchases purchase on purchase.session_id = member.session_id
    where member.user_id = auth.uid()
      and purchase.id = new.purchase_id;

    if actor_name is null then
      raise exception 'SESSION_ACCESS_DENIED';
    end if;

    if tg_op = 'INSERT' then
      new.added_by_name := actor_name;
      new.edited_by_name := null;
    else
      if new.purchase_id is distinct from old.purchase_id then
        raise exception 'PURCHASE_ITEM_CANNOT_MOVE';
      end if;
      new.id := old.id;
      new.purchase_id := old.purchase_id;
      new.planned_item_id := old.planned_item_id;
      new.added_by_name := old.added_by_name;
      new.created_at := old.created_at;
      new.edited_by_name := actor_name;
    end if;

    return new;
  end if;

  if tg_table_name = 'shopping_list_items' and tg_op = 'INSERT' then
    select member.display_name
      into actor_name
    from private.shopping_session_members member
    where member.user_id = auth.uid()
      and member.session_id = new.session_id;

    if actor_name is null then
      raise exception 'SESSION_ACCESS_DENIED';
    end if;

    new.added_by_name := actor_name;
    return new;
  end if;

  raise exception 'Unsupported item actor trigger operation';
end;
$$;

revoke all on function public.enforce_session_item_actor() from public, anon, authenticated;

drop trigger if exists enforce_purchase_item_actor on public.purchase_items;
create trigger enforce_purchase_item_actor
before insert or update on public.purchase_items
for each row execute function public.enforce_session_item_actor();

drop trigger if exists enforce_shopping_list_item_actor on public.shopping_list_items;
create trigger enforce_shopping_list_item_actor
before insert on public.shopping_list_items
for each row execute function public.enforce_session_item_actor();

-- Preserve the existing RPC signature for deployed clients, but ignore the
-- caller-provided buyer name; the trigger resolves the trusted member name.
create or replace function public.purchase_planned_shopping_item(
  p_item_id uuid,
  p_purchase_id uuid,
  p_unit_price_cents integer,
  p_buyer_name varchar
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_item public.shopping_list_items%rowtype;
  v_session_id uuid;
  v_purchase_item_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_unit_price_cents is null or p_unit_price_cents < 0 then
    raise exception 'A valid price is required';
  end if;

  select *
    into v_item
  from public.shopping_list_items
  where id = p_item_id
  for update;

  if not found or v_item.status <> 'pending' then
    raise exception 'PLANNED_ITEM_NOT_AVAILABLE';
  end if;

  v_session_id := v_item.session_id;

  if not exists (
    select 1
    from private.shopping_session_members member
    where member.user_id = auth.uid()
      and member.session_id = v_session_id
      and member.display_name is not null
  ) then
    raise exception 'SESSION_ACCESS_DENIED';
  end if;

  perform 1
  from public.purchases purchase
  where purchase.id = p_purchase_id
    and purchase.session_id = v_session_id
    and purchase.status = 'active'
  for update;

  if not found then
    raise exception 'ACTIVE_PURCHASE_NOT_FOUND';
  end if;

  insert into public.purchase_items (
    purchase_id,
    planned_item_id,
    name,
    quantity_milli,
    unit_price_cents
  )
  values (
    p_purchase_id,
    v_item.id,
    v_item.name,
    v_item.quantity_milli,
    p_unit_price_cents
  )
  returning id into v_purchase_item_id;

  update public.shopping_list_items
  set status = 'purchased',
      purchase_id = p_purchase_id,
      unit_price_cents = p_unit_price_cents,
      purchased_at = now()
  where id = p_item_id
    and status = 'pending';

  if not found then
    raise exception 'PLANNED_ITEM_NOT_AVAILABLE';
  end if;

  return v_purchase_item_id;
end;
$$;

revoke all on function public.purchase_planned_shopping_item(uuid, uuid, integer, varchar)
  from public, anon;
grant execute on function public.purchase_planned_shopping_item(uuid, uuid, integer, varchar)
  to authenticated, service_role;

revoke all on function public.update_planned_shopping_item(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.update_planned_shopping_item(uuid, text, integer, integer)
  to authenticated, service_role;

commit;
