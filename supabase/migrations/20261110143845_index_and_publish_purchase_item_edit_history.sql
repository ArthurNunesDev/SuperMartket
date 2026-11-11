create index if not exists purchase_item_edit_history_item_time_idx
  on public.purchase_item_edit_history (purchase_item_id, edited_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'purchase_item_edit_history'
     ) then
    alter publication supabase_realtime add table public.purchase_item_edit_history;
  end if;
end;
$$;
