-- Anya AI - complete Supabase initialization
-- Paste this entire file into the Supabase SQL Editor and select Run.
-- Safe to rerun: tables, indexes, policies, triggers, bucket, and Realtime
-- configuration are created or refreshed without deleting application data.

begin;

create extension if not exists pgcrypto;

-- Tables ---------------------------------------------------------------------

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null check (char_length(trim(store_name)) between 1 and 100),
  whatsapp_number text not null check (whatsapp_number ~ '^[0-9]{10,15}$'),
  store_slug text not null unique check (store_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_url text,
  tagline text not null default 'Powered by Anya AI',
  theme jsonb not null default '{"accent":"#c9a96e","mode":"dark"}'::jsonb,
  haggle_mode boolean not null default false,
  malayalam_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  image_url text not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text,
  price numeric(10,2) check (price is null or price >= 0),
  category text,
  vibe_tags text[] not null default '{}',
  occasion text,
  color_palette jsonb,
  ai_generated boolean not null default true,
  is_active boolean not null default true,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bundles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  recommended_product_id uuid not null references public.products(id) on delete cascade,
  recommendation_reason text,
  created_at timestamptz not null default now(),
  constraint bundle_products_must_differ check (product_id <> recommended_product_id),
  constraint bundles_unique_pair unique (product_id, recommended_product_id)
);

-- Indexes --------------------------------------------------------------------

create index if not exists idx_stores_owner on public.stores(owner_id);
create index if not exists idx_products_store_id on public.products(store_id);
create index if not exists idx_products_vibe_tags on public.products using gin(vibe_tags);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_occasion on public.products(occasion);
create index if not exists idx_products_created_at on public.products(created_at desc);
create index if not exists idx_bundles_product on public.bundles(product_id);

-- Shared timestamp trigger ----------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Public storefront view. security_invoker keeps table RLS in force. ----------

create or replace view public.products_with_badges
with (security_invoker = true)
as
select
  p.*,
  p.created_at > now() - interval '24 hours' as is_just_dropped,
  p.view_count > 50 as is_trending
from public.products as p
where p.is_active = true;

-- Row Level Security ----------------------------------------------------------

alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.bundles enable row level security;

drop policy if exists "Owners insert their stores" on public.stores;
create policy "Owners insert their stores"
  on public.stores for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners update their stores" on public.stores;
create policy "Owners update their stores"
  on public.stores for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners delete their stores" on public.stores;
create policy "Owners delete their stores"
  on public.stores for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Public can view stores" on public.stores;
create policy "Public can view stores"
  on public.stores for select to anon, authenticated
  using (true);

drop policy if exists "Store owners insert products" on public.products;
create policy "Store owners insert products"
  on public.products for insert to authenticated
  with check (
    exists (
      select 1 from public.stores as s
      where s.id = store_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Store owners update products" on public.products;
create policy "Store owners update products"
  on public.products for update to authenticated
  using (
    exists (
      select 1 from public.stores as s
      where s.id = store_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.stores as s
      where s.id = store_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Store owners delete products" on public.products;
create policy "Store owners delete products"
  on public.products for delete to authenticated
  using (
    exists (
      select 1 from public.stores as s
      where s.id = store_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Public can view active products" on public.products;
create policy "Public can view active products"
  on public.products for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Store owners manage bundles" on public.bundles;
create policy "Store owners manage bundles"
  on public.bundles for all to authenticated
  using (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Public can view bundles" on public.bundles;
create policy "Public can view bundles"
  on public.bundles for select to anon, authenticated
  using (true);

-- Product image storage -------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users upload product images" on storage.objects;
create policy "Authenticated users upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Owners update product images" on storage.objects;
create policy "Owners update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and owner_id = (select auth.uid()::text))
  with check (bucket_id = 'product-images' and owner_id = (select auth.uid()::text));

drop policy if exists "Owners delete product images" on storage.objects;
create policy "Owners delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and owner_id = (select auth.uid()::text));

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

-- Safe view counter -----------------------------------------------------------

create or replace function public.increment_product_view(target_product_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products
  set view_count = view_count + 1
  where id = target_product_id and is_active = true;
$$;

revoke all on function public.increment_product_view(uuid) from public;
grant execute on function public.increment_product_view(uuid) to anon, authenticated;

-- Realtime -------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end;
$$;

commit;

-- Optional smoke test after completion:
-- select table_name from information_schema.tables where table_schema = 'public';
-- select * from storage.buckets where id = 'product-images';
