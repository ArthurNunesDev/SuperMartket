alter table public.purchase_items
  add column if not exists edited_by_name varchar(50);

create table if not exists public.purchase_item_edit_history (
  id bigint generated always as identity primary key,
  purchase_item_id uuid not null references public.purchase_items(id) on delete cascade,
  edited_by_name varchar(50) not null check (char_length(btrim(edited_by_name)) between 1 and 50),
  edited_at timestamptz not null default now()
);

alter table public.purchase_item_edit_history enable row level security;
revoke all on public.purchase_item_edit_history from public, anon;
grant select on public.purchase_item_edit_history to authenticated;

create policy "authorized family devices can read item edit history"
  on public.purchase_item_edit_history
  for select to authenticated
  using ((select private.is_family_device_authorized()));

create or replace function public.record_purchase_item_edit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.edited_by_name is null
     or char_length(btrim(new.edited_by_name)) not between 1 and 50 then
    raise exception 'A valid editor name is required';
  end if;

  insert into public.purchase_item_edit_history (
    purchase_item_id,
    edited_by_name
  ) values (
    new.id,
    new.edited_by_name
  );

  return new;
end;
$$;

revoke all on function public.record_purchase_item_edit() from public, anon, authenticated;

drop trigger if exists purchase_item_edit_history_after_update on public.purchase_items;
create trigger purchase_item_edit_history_after_update
after update of name, quantity_milli, unit_price_cents
on public.purchase_items
for each row
when (
  old.name is distinct from new.name
  or old.quantity_milli is distinct from new.quantity_milli
  or old.unit_price_cents is distinct from new.unit_price_cents
)
execute function public.record_purchase_item_edit();

revoke update on public.purchase_items from authenticated;
grant update (name, quantity_milli, unit_price_cents, edited_by_name) on public.purchase_items to authenticated;
