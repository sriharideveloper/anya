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

commit;
