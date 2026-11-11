-- Run after applying 20261111160000_harden_session_data_access.sql.
-- These assertions are read-only and intentionally fail if a privilege regresses.
do $$
begin
  if has_table_privilege('authenticated', 'public.purchases', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.purchase_items', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.shopping_list_items', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.purchase_item_edit_history', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.purchases', 'REFERENCES')
    or has_table_privilege('authenticated', 'public.purchase_items', 'REFERENCES')
    or has_table_privilege('authenticated', 'public.shopping_list_items', 'REFERENCES') then
    raise exception 'Authenticated users must not have TRUNCATE privileges';
  end if;

  if has_table_privilege('authenticated', 'public.purchases', 'TRIGGER')
    or has_table_privilege('authenticated', 'public.purchase_items', 'TRIGGER')
    or has_table_privilege('authenticated', 'public.shopping_list_items', 'TRIGGER')
    or has_table_privilege('authenticated', 'public.purchase_item_edit_history', 'TRIGGER') then
    raise exception 'Authenticated users must not have TRIGGER privileges';
  end if;

  if has_column_privilege('authenticated', 'public.purchase_items', 'added_by_name', 'INSERT')
    or has_column_privilege('authenticated', 'public.purchase_items', 'edited_by_name', 'UPDATE')
    or has_column_privilege('authenticated', 'public.shopping_list_items', 'added_by_name', 'INSERT') then
    raise exception 'Browser users must not set item actor names';
  end if;

  if has_function_privilege('anon', 'public.purchase_planned_shopping_item(uuid,uuid,integer,character varying)', 'EXECUTE')
    or has_function_privilege('anon', 'public.update_planned_shopping_item(uuid,text,integer,integer)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.set_shopping_session_member_name(uuid,text)', 'EXECUTE') then
    raise exception 'Privileged RPC execution grants are too broad';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.purchase_items'::regclass
      and tgname = 'enforce_purchase_item_actor'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.shopping_list_items'::regclass
      and tgname = 'enforce_shopping_list_item_actor'
      and not tgisinternal
  ) then
    raise exception 'Server-side item authorship triggers are missing';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.purchases'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.purchase_items'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.shopping_list_items'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.purchase_item_edit_history'::regclass) then
    raise exception 'RLS must remain enabled on all shared application tables';
  end if;
end;
$$;
