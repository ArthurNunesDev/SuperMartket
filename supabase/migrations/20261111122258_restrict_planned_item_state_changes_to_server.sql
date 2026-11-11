drop policy if exists "session members can update planned shopping items" on public.shopping_list_items;
revoke update on public.shopping_list_items from authenticated;
