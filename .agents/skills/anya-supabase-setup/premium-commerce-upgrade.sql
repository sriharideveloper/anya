-- Anya AI premium commerce upgrade
-- Safe to rerun. Existing product data is preserved.

begin;

alter table public.products
  add column if not exists compare_at_price numeric(10,2),
  add column if not exists stock_quantity integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_compare_at_price_nonnegative'
  ) then
    alter table public.products
      add constraint products_compare_at_price_nonnegative
      check (compare_at_price is null or compare_at_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_stock_quantity_nonnegative'
  ) then
    alter table public.products
      add constraint products_stock_quantity_nonnegative
      check (stock_quantity >= 0);
  end if;
end;
$$;

-- Refresh the public view so databases upgraded from an older schema expose
-- stock and compare-at pricing to storefronts.
drop view if exists public.products_with_badges;
create view public.products_with_badges
with (security_invoker = true)
as
select
  p.*,
  p.created_at > now() - interval '24 hours' as is_just_dropped,
  p.view_count > 50 as is_trending
from public.products as p
where p.is_active = true;

grant select on public.products_with_badges to anon, authenticated;

-- A bundle may only pair products from the same store owned by the seller.
drop policy if exists "Store owners manage bundles" on public.bundles;
create policy "Store owners manage bundles"
  on public.bundles for all to authenticated
  using (
    exists (
      select 1
      from public.products as p
      join public.products as recommended on recommended.id = recommended_product_id
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and recommended.store_id = p.store_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products as p
      join public.products as recommended on recommended.id = recommended_product_id
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and recommended.store_id = p.store_id
        and s.owner_id = (select auth.uid())
    )
  );

commit;
