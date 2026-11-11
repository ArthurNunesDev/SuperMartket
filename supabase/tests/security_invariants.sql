-- Run after applying 20261111160000_harden_session_data_access.sql.
-- These assertions are read-only and intentionally fail if a privilege regresses.
do $$
begin
  if has_table_privilege('authenticated', 'public.purchases', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.purchase_items', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.shopping_list_items', 'TRUNCATE')
    or has_table_privilege('authenticated', 'public.purchase_item_edit_history', 'TRUNCATE') then
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

  if not (select relrowsecurity from pg_class where oid = 'public.purchases'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.purchase_items'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.shopping_list_items'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.purchase_item_edit_history'::regclass) then
    raise exception 'RLS must remain enabled on all shared application tables';
  end if;
end;
$$;
