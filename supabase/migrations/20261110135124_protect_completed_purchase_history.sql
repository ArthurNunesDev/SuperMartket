drop policy if exists "authorized family devices can delete purchases" on public.purchases;
revoke delete on public.purchases from authenticated;