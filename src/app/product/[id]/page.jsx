import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ProductDetail from '@/components/ProductDetail/ProductDetail';
import ProductViewTracker from '@/components/ProductViewTracker/ProductViewTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LEGACY_PUBLIC_PRODUCT_FIELDS = [
  'id',
  'store_id',
  'image_url',
  'title',
  'description',
  'price',
  'compare_at_price',
  'stock_quantity',
  'category',
  'vibe_tags',
  'occasion',
  'color_palette',
  'ai_generated',
  'is_active',
  'view_count',
  'created_at',
  'updated_at',
].join(',');

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function textOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function listFrom(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Legacy installations may return comma-separated tags.
  }

  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function objectFrom(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function siteUrl() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : 'http://localhost:3000')).replace(/\/$/, '');
}

function normalizeMedia(rows, product) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const normalized = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && row.is_visible !== false && row.is_storefront_visible !== false && row.visibility !== 'private')
    .map((row, index) => {
      let url = textOrEmpty(row.public_url ?? row.legacy_image_url ?? row.media_url ?? row.url ?? row.image_url);
      if (!url && row.storage_bucket && row.storage_path && supabaseUrl) {
        url = `${supabaseUrl}/storage/v1/object/public/${row.storage_bucket}/${row.storage_path}`;
      }
      return {
        id: String(row.id || `media-${index}`),
        url,
        alt: textOrEmpty(row.alt_text ?? row.alt) || textOrEmpty(product.title),
        label: row.is_cover || row.is_primary || row.kind === 'cover' ? 'COVER' : row.origin === 'ai' || row.kind === 'ai_visual' || row.media_type === 'generated' ? 'ANYA VISUAL' : 'PRODUCT VIEW',
        isCover: Boolean(row.is_cover || row.is_primary || row.kind === 'cover'),
        sortOrder: numberOrNull(row.sort_order ?? row.position) ?? index,
      };
    })
    .filter((item) => item.url)
    .sort((first, second) => Number(second.isCover) - Number(first.isCover) || first.sortOrder - second.sortOrder);

  const legacyUrl = textOrEmpty(product.image_url ?? product.image);
  if (legacyUrl && !normalized.some((item) => item.url === legacyUrl)) {
    normalized.push({ id: 'legacy-cover', url: legacyUrl, alt: textOrEmpty(product.title), label: 'PRODUCT VIEW', isCover: normalized.length === 0, sortOrder: normalized.length });
  }

  return normalized;
}

function normalizeVariants(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row.id),
    options: objectFrom(row.option_values ?? row.options),
    price: numberOrNull(row.price ?? row.price_override),
    compareAtPrice: numberOrNull(row.compare_at_price),
    stockQuantity: numberOrNull(row.stock_quantity ?? row.quantity),
    isActive: row.is_active !== false,
  }));
}

function normalizeProduct(product, store, mediaRows, variantRows) {
  const basePrice = numberOrNull(product.price) ?? 0;
  const explicitSalePrice = numberOrNull(product.discounted_price ?? product.sale_price ?? product.discount_price);
  const explicitCompareAt = numberOrNull(product.compare_at_price ?? product.original_price ?? product.mrp ?? product.list_price);
  const hasSalePrice = explicitSalePrice !== null && explicitSalePrice >= 0 && explicitSalePrice < basePrice;
  const price = hasSalePrice ? explicitSalePrice : basePrice;
  const compareAtPrice = hasSalePrice
    ? basePrice
    : explicitCompareAt !== null && explicitCompareAt > price
      ? explicitCompareAt
      : null;

  const quantity = numberOrNull(product.stock_quantity ?? product.quantity ?? product.qty ?? product.inventory_count);
  const explicitlyUnavailable = product.in_stock === false || ['out_of_stock', 'sold_out', 'unavailable'].includes(textOrEmpty(product.stock_status).toLowerCase());
  const outOfStock = explicitlyUnavailable || quantity === 0;
  const limitedStock = !outOfStock && quantity !== null && quantity > 0 && quantity <= 5;
  const media = normalizeMedia(mediaRows, product);

  return {
    id: String(product.id),
    title: textOrEmpty(product.title) || 'Untitled boutique piece',
    description: textOrEmpty(product.description) || 'A thoughtfully curated piece from this boutique collection.',
    imageUrl: media[0]?.url || textOrEmpty(product.image_url ?? product.image),
    media,
    category: textOrEmpty(product.category) || 'Boutique edit',
    categoryPath: listFrom(product.category_path),
    occasion: textOrEmpty(product.occasion ?? product.recommended_occasion ?? product.occasion_name) || 'Curated edit',
    region: textOrEmpty(product.region ?? product.location ?? store?.location ?? store?.city) || 'Kerala',
    vibeTags: listFrom(product.vibe_tags ?? product.vibes ?? product.tags).slice(0, 8),
    attributes: objectFrom(product.attributes),
    price,
    compareAtPrice,
    stockQuantity: quantity,
    stockState: outOfStock ? 'out' : limitedStock ? 'limited' : 'available',
    variants: normalizeVariants(variantRows),
    createdAt: product.created_at || null,
  };
}

function normalizeStore(store) {
  return {
    name: textOrEmpty(store?.store_name ?? store?.name) || 'Anya boutique',
    slug: textOrEmpty(store?.store_slug ?? store?.slug),
    tagline: textOrEmpty(store?.tagline),
    phone: textOrEmpty(store?.whatsapp_number ?? store?.phone) || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
    bargainMode: Boolean(store?.bargain_mode),
  };
}

const getProductPageData = cache(async (id) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !id) return null;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    let { data: product, error } = await supabase
      .from('products_with_badges')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      const legacyResult = await supabase
        .from('products')
        .select(LEGACY_PUBLIC_PRODUCT_FIELDS)
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      product = legacyResult.data;
      error = legacyResult.error;
    }

    if (error || !product || product.is_active === false) return null;

    const [storeResult, mediaResult, variantResult] = await Promise.all([
      supabase
        .from('stores')
        .select('id,store_name,store_slug,whatsapp_number,tagline,bargain_mode,malayalam_mode,logo_url')
        .eq('id', product.store_id)
        .maybeSingle(),
      supabase.from('product_media').select('*').eq('product_id', product.id),
      supabase.from('product_variants').select('*').eq('product_id', product.id),
    ]);

    return {
      product: normalizeProduct(
        product,
        storeResult.data,
        mediaResult.error ? [] : mediaResult.data,
        variantResult.error ? [] : variantResult.data,
      ),
      store: normalizeStore(storeResult.data),
    };
  } catch (error) {
    console.error('Product page could not be loaded:', error);
    return null;
  }
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await getProductPageData(id);

  if (!data) {
    return {
      title: 'Product unavailable',
      description: 'This boutique product is no longer available.',
      robots: { index: false, follow: false },
    };
  }

  const { product, store } = data;
  const canonical = `/product/${encodeURIComponent(product.id)}`;
  const description = `${product.title} from ${store.name}. ${product.description}`.slice(0, 200);

  return {
    title: product.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${product.title} · ${store.name}`,
      description,
      url: canonical,
      siteName: store.name,
      locale: 'en_IN',
      type: 'website',
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.title }] : undefined,
    },
    twitter: {
      card: product.imageUrl ? 'summary_large_image' : 'summary',
      title: product.title,
      description,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }) {
  const { id } = await params;
  const data = await getProductPageData(id);
  if (!data) notFound();

  const shareUrl = `${siteUrl()}/product/${encodeURIComponent(data.product.id)}`;
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: data.product.title,
    image: data.product.media.length ? data.product.media.map((item) => item.url) : undefined,
    description: data.product.description,
    category: data.product.category,
    brand: { '@type': 'Brand', name: data.store.name },
    offers: {
      '@type': 'Offer',
      url: shareUrl,
      priceCurrency: 'INR',
      price: data.product.price,
      availability: data.product.stockState === 'out' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }}
      />
      <ProductViewTracker productId={data.product.id} />
      <ProductDetail product={data.product} store={data.store} shareUrl={shareUrl} />
    </>
  );
}
