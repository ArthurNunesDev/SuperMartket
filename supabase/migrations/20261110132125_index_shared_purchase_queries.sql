create index if not exists purchases_created_at_idx
  on public.purchases (created_at desc);

create index if not exists purchase_items_purchase_id_created_at_idx
  on public.purchase_items (purchase_id, created_at asc);