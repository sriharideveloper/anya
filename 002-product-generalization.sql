-- Anya AI - product generalization forward migration
-- Run after supabase-setup.sql. Safe to rerun; existing data is preserved.
-- Product kinds remain free-form text so the catalog can expand beyond apparel.

begin;

-- Flexible product model ------------------------------------------------------

alter table public.stores
  rename column haggle_mode to bargain_mode;

alter table public.products
  add column if not exists category_path text[] not null default '{}',
  add column if not exists audience_tags text[] not null default '{}',
  add column if not exists attributes jsonb not null default '{}'::jsonb,
  add column if not exists detection_confidence numeric(5,4),
  add column if not exists search_document tsvector,
  add column if not exists compare_at_price numeric(10,2)
    check (compare_at_price is null or compare_at_price >= 0),
  add column if not exists stock_quantity integer not null default 1
    check (stock_quantity >= 0),
  add column if not exists occasion text,
  add column if not exists color_palette jsonb,
  add column if not exists vibe_tags text[] not null default '{}',
  add column if not exists view_count integer not null default 0 check (view_count >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_detection_confidence_range'
  ) then
    alter table public.products
      add constraint products_detection_confidence_range
      check (
        detection_confidence is null
        or detection_confidence between 0 and 1
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_attributes_object'
  ) then
    alter table public.products
      add constraint products_attributes_object
      check (jsonb_typeof(attributes) = 'object');
  end if;
end;
$$;

create or replace function public.build_product_search_document(
  product_title text,
  product_description text,
  product_category text,
  product_occasion text,
  product_vibe_tags text[],
  product_category_path text[],
  product_audience_tags text[],
  product_attributes jsonb
)
returns tsvector
language sql
immutable
set search_path = ''
as $$
  select
    setweight(
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          coalesce(product_title, ''),
          coalesce(product_category, '')
        )
      ),
      'A'
    )
    ||
    setweight(
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          coalesce(product_occasion, ''),
          coalesce(array_to_string(product_vibe_tags, ' '), ''),
          coalesce(array_to_string(product_category_path, ' '), ''),
          coalesce(array_to_string(product_audience_tags, ' '), '')
        )
      ),
      'B'
    )
    ||
    setweight(
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          coalesce(product_description, ''),
          coalesce(product_attributes::text, '')
        )
      ),
      'C'
    );
$$;

create or replace function public.set_product_search_document()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document := public.build_product_search_document(
    new.title,
    new.description,
    new.category,
    new.occasion,
    new.vibe_tags,
    new.category_path,
    new.audience_tags,
    new.attributes
  );
  return new;
end;
$$;

drop trigger if exists products_set_search_document on public.products;
create trigger products_set_search_document
  before insert or update of
    title,
    description,
    category,
    occasion,
    vibe_tags,
    category_path,
    audience_tags,
    attributes
  on public.products
  for each row execute function public.set_product_search_document();

update public.products
set search_document = public.build_product_search_document(
  title,
  description,
  category,
  occasion,
  vibe_tags,
  category_path,
  audience_tags,
  attributes
)
where search_document is distinct from public.build_product_search_document(
    title,
    description,
    category,
  occasion,
  vibe_tags,
  category_path,
  audience_tags,
  attributes
);

create index if not exists idx_products_search_document
  on public.products using gin(search_document);
create index if not exists idx_products_category_path
  on public.products using gin(category_path);
create index if not exists idx_products_audience_tags
  on public.products using gin(audience_tags);
create index if not exists idx_products_attributes
  on public.products using gin(attributes jsonb_path_ops);
-- AI generation audit trail --------------------------------------------------

create table if not exists public.product_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null unique,
  input_hash text not null,
  reference_media_ids uuid[] not null default '{}',
  brand_asset_ids uuid[] not null default '{}',
  requested_count integer not null default 1
    check (requested_count between 1 and 5),
  completed_count integer not null default 0
    check (completed_count >= 0 and completed_count <= requested_count),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  model_name text,
  prompt_version text,
  usage_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(usage_metadata) = 'object'),
  safe_error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);

create index if not exists idx_product_generation_jobs_store_created
  on public.product_generation_jobs(store_id, created_at desc);
create index if not exists idx_product_generation_jobs_product
  on public.product_generation_jobs(product_id);
create index if not exists idx_product_generation_jobs_requester
  on public.product_generation_jobs(requested_by, created_at desc);
create index if not exists idx_product_generation_jobs_status
  on public.product_generation_jobs(status, created_at desc);

-- Product media ---------------------------------------------------------------

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  generation_job_id uuid
    references public.product_generation_jobs(id) on delete set null,
  storage_bucket text,
  storage_path text,
  legacy_image_url text,
  origin text not null default 'seller',
  use_as_generation_reference boolean not null default false,
  is_storefront_visible boolean not null default false,
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not is_primary
    or is_storefront_visible
  ),
  check (
    not is_storefront_visible
    or (
      storage_bucket = 'product-images'
      and nullif(trim(coalesce(legacy_image_url, '')), '') is not null
    )
  ),
  check (
    nullif(trim(coalesce(storage_path, '')), '') is not null
    or nullif(trim(coalesce(legacy_image_url, '')), '') is not null
  )
);

create index if not exists idx_product_media_product_order
  on public.product_media(
    product_id,
    is_storefront_visible desc,
    sort_order,
    created_at
  );
create index if not exists idx_product_media_generation_job
  on public.product_media(generation_job_id);
create unique index if not exists idx_product_media_one_cover
  on public.product_media(product_id)
  where is_primary = true;

-- Private AI metadata --------------------------------------------------------

create table if not exists public.product_ai_metadata (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique
    references public.products(id) on delete cascade,
  analysis jsonb not null default '{}'::jsonb
    check (jsonb_typeof(analysis) = 'object'),
  seller_insight jsonb not null default '{}'::jsonb
    check (jsonb_typeof(seller_insight) = 'object'),
  price_suggestion jsonb not null default '{}'::jsonb
    check (jsonb_typeof(price_suggestion) = 'object'),
  model_name text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Durable seller AI quota ----------------------------------------------------

create table if not exists public.seller_ai_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  units_used integer not null default 0 check (units_used >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.consume_seller_ai_quota(
  target_user_id uuid,
  requested_units integer,
  unit_limit integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if target_user_id is null
     or requested_units < 1
     or requested_units > 10
     or unit_limit < 1
     or unit_limit > 1000
     or window_seconds < 60
     or window_seconds > 86400 then
    raise exception 'Invalid AI quota request.'
      using errcode = '22023';
  end if;

  insert into public.seller_ai_quotas as quota (
    user_id,
    window_started_at,
    units_used,
    updated_at
  )
  values (target_user_id, now(), requested_units, now())
  on conflict (user_id) do update
  set
    window_started_at = case
      when quota.window_started_at <= now() - make_interval(secs => window_seconds)
        then now()
      else quota.window_started_at
    end,
    units_used = case
      when quota.window_started_at <= now() - make_interval(secs => window_seconds)
        then requested_units
      else quota.units_used + requested_units
    end,
    updated_at = now()
  returning units_used <= unit_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_seller_ai_quota(
  uuid,
  integer,
  integer,
  integer
) from public, anon, authenticated;
grant execute on function public.consume_seller_ai_quota(
  uuid,
  integer,
  integer,
  integer
) to service_role;

-- Flexible sellable variants -------------------------------------------------

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  option_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(option_values) = 'object'),
  price numeric(10,2) check (price is null or price >= 0),
  compare_at_price numeric(10,2)
    check (compare_at_price is null or compare_at_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    compare_at_price is null
    or price is null
    or compare_at_price >= price
  )
);

create index if not exists idx_product_variants_product
  on public.product_variants(product_id, is_active desc, sort_order);
create unique index if not exists idx_product_variants_product_sku
  on public.product_variants(product_id, sku)
  where sku is not null;
create index if not exists idx_product_variants_options
  on public.product_variants using gin(option_values jsonb_path_ops);

-- Store-owned brand assets ---------------------------------------------------

create table if not exists public.store_brand_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  legacy_image_url text,
  asset_kind text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    nullif(trim(coalesce(storage_path, '')), '') is not null
    or nullif(trim(coalesce(legacy_image_url, '')), '') is not null
  )
);

create index if not exists idx_store_brand_assets_store
  on public.store_brand_assets(store_id, is_active desc, sort_order);

-- Cross-table ownership and consistency guards -------------------------------

create or replace function public.validate_product_generation_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_store_id uuid;
  store_owner uuid;
begin
  select p.store_id, s.owner_id
  into resolved_store_id, store_owner
  from public.products as p
  join public.stores as s on s.id = p.store_id
  where p.id = new.product_id;

  if resolved_store_id is null or store_owner is null then
    raise exception 'Generation job product does not exist.';
  end if;

  new.store_id := resolved_store_id;
  new.requested_by := store_owner;

  if exists (
    select 1
    from unnest(new.reference_media_ids) as reference_id
    where not exists (
      select 1
      from public.product_media as media
      join public.products as media_product
        on media_product.id = media.product_id
      where media.id = reference_id
        and media_product.store_id = resolved_store_id
        and media.use_as_generation_reference = true
    )
  ) then
    raise exception
      'Generation job references must be seller-approved media from the same store.';
  end if;

  if exists (
    select 1
    from unnest(new.brand_asset_ids) as brand_asset_id
    where not exists (
      select 1
      from public.store_brand_assets as asset
      where asset.id = brand_asset_id
        and asset.store_id = resolved_store_id
        and asset.is_active = true
    )
  ) then
    raise exception
      'Generation job brand assets must belong to the same store.';
  end if;

  return new;
end;
$$;

drop trigger if exists product_generation_jobs_validate on public.product_generation_jobs;
create trigger product_generation_jobs_validate
  before insert or update of store_id, product_id, requested_by
  on public.product_generation_jobs
  for each row execute function public.validate_product_generation_job();

create or replace function public.validate_product_job_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.generation_job_id is not null and not exists (
    select 1
    from public.product_generation_jobs as j
    join public.products as p on p.id = new.product_id
    where j.id = new.generation_job_id
      and j.store_id = p.store_id
      and (j.product_id is null or j.product_id = new.product_id)
  ) then
    raise exception 'Generation job and product must belong to the same store.';
  end if;

  return new;
end;
$$;

drop trigger if exists product_media_validate_job on public.product_media;
create trigger product_media_validate_job
  before insert or update of product_id, generation_job_id
  on public.product_media
  for each row execute function public.validate_product_job_link();

create or replace function public.set_generalized_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_generation_jobs_set_updated_at
  on public.product_generation_jobs;
create trigger product_generation_jobs_set_updated_at
  before update on public.product_generation_jobs
  for each row execute function public.set_generalized_updated_at();

drop trigger if exists product_media_set_updated_at on public.product_media;
create trigger product_media_set_updated_at
  before update on public.product_media
  for each row execute function public.set_generalized_updated_at();

drop trigger if exists product_ai_metadata_set_updated_at
  on public.product_ai_metadata;
create trigger product_ai_metadata_set_updated_at
  before update on public.product_ai_metadata
  for each row execute function public.set_generalized_updated_at();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
  before update on public.product_variants
  for each row execute function public.set_generalized_updated_at();

drop trigger if exists store_brand_assets_set_updated_at
  on public.store_brand_assets;
create trigger store_brand_assets_set_updated_at
  before update on public.store_brand_assets
  for each row execute function public.set_generalized_updated_at();

-- Preserve legacy image_url while making it the first canonical media row.
insert into public.product_media (
  product_id,
  storage_bucket,
  legacy_image_url,
  origin,
  use_as_generation_reference,
  is_storefront_visible,
  is_primary,
  sort_order
)
select
  p.id,
  'product-images',
  p.image_url,
  'seller',
  false,
  true,
  true,
  0
from public.products as p
where nullif(trim(p.image_url), '') is not null
  and not exists (
    select 1
    from public.product_media as media
    where media.product_id = p.id
  );

-- Public-safe views use explicit columns; internal AI/search fields never leak.
drop view if exists public.products_with_badges;
create view public.products_with_badges
with (security_invoker = true)
as
select
  p.id,
  p.store_id,
  p.image_url,
  p.title,
  p.description,
  p.price,
  p.compare_at_price,
  p.stock_quantity,
  p.category,
  p.category_path,
  p.vibe_tags,
  p.audience_tags,
  p.occasion,
  p.color_palette,
  p.attributes,
  p.ai_generated,
  p.is_active,
  p.view_count,
  p.created_at,
  p.updated_at,
  p.created_at > now() - interval '24 hours' as is_just_dropped,
  p.view_count > 50 as is_trending
from public.products as p
where p.is_active = true;

drop view if exists public.stores_public;
create view public.stores_public
with (security_invoker = true)
as
select
  s.id,
  s.store_name,
  s.whatsapp_number,
  s.store_slug,
  s.logo_url,
  s.tagline,
  s.theme,
  s.bargain_mode,
  s.malayalam_mode,
  s.created_at,
  s.updated_at
from public.stores as s;

-- Row Level Security and Data API grants -------------------------------------

alter table public.product_generation_jobs enable row level security;
alter table public.product_media enable row level security;
alter table public.product_ai_metadata enable row level security;
alter table public.seller_ai_quotas enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_brand_assets enable row level security;

-- Remove the legacy table-wide read grant so private confidence/search fields
-- cannot be requested by bypassing the public-safe view.
revoke select on public.products from anon, authenticated;
grant select (
  id,
  store_id,
  image_url,
  title,
  description,
  price,
  compare_at_price,
  stock_quantity,
  category,
  category_path,
  vibe_tags,
  audience_tags,
  occasion,
  color_palette,
  attributes,
  ai_generated,
  is_active,
  view_count,
  created_at,
  updated_at
) on public.products to anon, authenticated;

revoke all on public.product_generation_jobs from anon, authenticated;
revoke all on public.product_ai_metadata from anon, authenticated;
revoke all on public.seller_ai_quotas from anon, authenticated;
revoke all on public.product_media, public.product_variants,
  public.store_brand_assets from anon;
grant select, insert, update, delete
  on public.product_generation_jobs, public.product_ai_metadata
  to authenticated;

grant select on public.product_media, public.product_variants to anon;
grant select, insert, update, delete
  on public.product_media, public.product_variants, public.store_brand_assets
  to authenticated;
grant select on public.products_with_badges, public.stores_public
  to anon, authenticated;

drop policy if exists "Owners manage product generation jobs"
  on public.product_generation_jobs;
create policy "Owners manage product generation jobs"
  on public.product_generation_jobs for all to authenticated
  using (
    requested_by = (select auth.uid())
    and exists (
      select 1
      from public.stores as s
      where s.id = store_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    requested_by = (select auth.uid())
    and exists (
      select 1
      from public.stores as s
      where s.id = store_id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Public views visible product media"
  on public.product_media;
create policy "Public views visible product media"
  on public.product_media for select to anon, authenticated
  using (
    is_storefront_visible
    and exists (
      select 1
      from public.products as p
      where p.id = product_id
        and p.is_active = true
    )
  );

drop policy if exists "Owners manage product media" on public.product_media;
create policy "Owners manage product media"
  on public.product_media for all to authenticated
  using (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners manage product AI metadata"
  on public.product_ai_metadata;
create policy "Owners manage product AI metadata"
  on public.product_ai_metadata for all to authenticated
  using (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Public views active product variants"
  on public.product_variants;
create policy "Public views active product variants"
  on public.product_variants for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.products as p
      where p.id = product_id
        and p.is_active = true
    )
  );

drop policy if exists "Owners manage product variants"
  on public.product_variants;
create policy "Owners manage product variants"
  on public.product_variants for all to authenticated
  using (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.products as p
      join public.stores as s on s.id = p.store_id
      where p.id = product_id
        and s.owner_id = (select auth.uid())
    )
  );

-- Replaces a product's entire option matrix in one transaction. Call this RPC
-- with the seller's authenticated client so auth.uid() can prove ownership.
create or replace function public.replace_product_variants(
  target_product_id uuid,
  replacement_variants jsonb
)
returns setof public.product_variants
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.products as p
    join public.stores as s on s.id = p.store_id
    where p.id = target_product_id
      and s.owner_id = (select auth.uid())
  ) then
    raise exception 'Product does not belong to the signed-in seller.'
      using errcode = '42501';
  end if;

  if replacement_variants is null
     or jsonb_typeof(replacement_variants) <> 'array' then
    raise exception 'replacement_variants must be a JSON array.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(replacement_variants) > 100 then
    raise exception 'A product may have at most 100 variants.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(replacement_variants) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or jsonb_typeof(
        coalesce(
          entry.value -> 'option_values',
          entry.value -> 'optionValues',
          entry.value -> 'options'
        )
      ) <> 'object'
  ) then
    raise exception 'Every variant must contain an option-values object.'
      using errcode = '22023';
  end if;

  delete from public.product_variants as variant
  where variant.product_id = target_product_id;

  insert into public.product_variants (
    product_id,
    option_values,
    price,
    compare_at_price,
    stock_quantity,
    sku,
    is_active,
    sort_order
  )
  select
    target_product_id,
    coalesce(
      entry.value -> 'option_values',
      entry.value -> 'optionValues',
      entry.value -> 'options'
    ),
    case
      when nullif(entry.value ->> 'price', '') is null then null
      else (entry.value ->> 'price')::numeric
    end,
    case
      when nullif(
        coalesce(
          entry.value ->> 'compare_at_price',
          entry.value ->> 'compareAtPrice'
        ),
        ''
      ) is null then null
      else coalesce(
        entry.value ->> 'compare_at_price',
        entry.value ->> 'compareAtPrice'
      )::numeric
    end,
    coalesce(
      nullif(entry.value ->> 'stock_quantity', '')::integer,
      nullif(entry.value ->> 'stockQuantity', '')::integer,
      0
    ),
    nullif(trim(entry.value ->> 'sku'), ''),
    coalesce(
      (entry.value ->> 'is_active')::boolean,
      (entry.value ->> 'isActive')::boolean,
      true
    ),
    coalesce(
      nullif(entry.value ->> 'sort_order', '')::integer,
      nullif(entry.value ->> 'sortOrder', '')::integer,
      entry.ordinality::integer - 1
    )
  from jsonb_array_elements(replacement_variants)
    with ordinality as entry(value, ordinality);

  return query
    select variant.*
    from public.product_variants as variant
    where variant.product_id = target_product_id
    order by variant.sort_order, variant.created_at, variant.id;
end;
$$;

revoke all on function public.replace_product_variants(uuid, jsonb)
  from public, anon;
grant execute on function public.replace_product_variants(uuid, jsonb)
  to authenticated;

drop policy if exists "Public views active store brand assets"
  on public.store_brand_assets;

drop policy if exists "Owners manage store brand assets"
  on public.store_brand_assets;
create policy "Owners manage store brand assets"
  on public.store_brand_assets for all to authenticated
  using (
    exists (
      select 1
      from public.stores as s
      where s.id = store_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.stores as s
      where s.id = store_id
        and s.owner_id = (select auth.uid())
    )
  );

-- Private product reference images. Object keys must start with auth.uid().
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-references',
  'product-references',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners read product references" on storage.objects;
create policy "Owners read product references"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'product-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners upload product references" on storage.objects;
create policy "Owners upload product references"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners update product references" on storage.objects;
create policy "Owners update product references"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'product-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Owners delete product references" on storage.objects;
create policy "Owners delete product references"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-references'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Transactional verification -------------------------------------------------

do $$
declare
  required_table text;
  required_column text;
begin
  foreach required_table in array array[
    'product_generation_jobs',
    'product_media',
    'product_ai_metadata',
    'seller_ai_quotas',
    'product_variants',
    'store_brand_assets'
  ]
  loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Product generalization failed: missing %.', required_table;
    end if;
  end loop;

  foreach required_column in array array[
    'category_path',
    'audience_tags',
    'attributes',
    'detection_confidence',
    'search_document'
  ]
  loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = required_column
    ) then
      raise exception
        'Product generalization failed: products.% is missing.',
        required_column;
    end if;
  end loop;

  if exists (
    select 1
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'product_generation_jobs',
        'product_media',
        'product_ai_metadata',
        'seller_ai_quotas',
        'product_variants',
        'store_brand_assets'
      )
      and not c.relrowsecurity
  ) then
    raise exception 'Product generalization failed: RLS is not enabled.';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'product-references'
      and public = false
  ) then
    raise exception
      'Product generalization failed: private product-references bucket is missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'products_set_search_document'
      and not tgisinternal
  ) then
    raise exception
      'Product generalization failed: search trigger is missing.';
  end if;

  if to_regprocedure(
    'public.replace_product_variants(uuid,jsonb)'
  ) is null then
    raise exception
      'Product generalization failed: variant replacement RPC is missing.';
  end if;

  if to_regprocedure(
    'public.consume_seller_ai_quota(uuid,integer,integer,integer)'
  ) is null then
    raise exception
      'Product generalization failed: seller AI quota function is missing.';
  end if;

  if has_column_privilege(
       'anon',
       'public.products',
       'detection_confidence',
       'SELECT'
     )
     or has_column_privilege(
       'anon',
       'public.products',
       'search_document',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.store_brand_assets',
       'SELECT'
     ) then
    raise exception
      'Product generalization failed: a private field or asset is publicly readable.';
  end if;
end;
$$;

commit;
