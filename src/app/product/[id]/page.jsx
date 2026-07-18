import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ProductDetail from '@/components/ProductDetail/ProductDetail';
import ProductViewTracker from '@/components/ProductViewTracker/ProductViewTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FALLBACK_INSIGHT = 'This product is likely to perform well during festive shopping because of its vibrant colour palette and traditional styling.';

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
    // Supabase may return legacy comma-separated tags instead of JSON.
  }

  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function siteUrl() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : 'http://localhost:3000')).replace(/\/$/, '');
}

function normalizeProduct(product, store) {
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
  const vibeTags = listFrom(product.vibe_tags ?? product.vibes ?? product.tags).slice(0, 8);
  const occasion = textOrEmpty(product.occasion ?? product.recommended_occasion ?? product.occasion_name) || 'Festive edit';
  const audience = textOrEmpty(product.target_audience ?? product.audience ?? product.customer_profile) || 'Style-conscious women';
  const category = textOrEmpty(product.category) || 'Boutique edit';
  const confidence = numberOrNull(product.ai_confidence ?? product.confidence_score ?? product.merchandising_confidence) ?? 97;
  const generatedSeconds = numberOrNull(product.generated_in_seconds ?? product.generation_time_seconds ?? product.ai_generation_time) ?? 1.2;
  const region = textOrEmpty(product.region ?? product.location ?? store?.location ?? store?.city) || 'Kerala';
  const priceRecommendation = textOrEmpty(product.price_recommendation ?? product.recommended_price_range)
    || (compareAtPrice ? `Strong at ₹${price.toLocaleString('en-IN')}` : `Ideal at ₹${price.toLocaleString('en-IN')}`);

  return {
    id: String(product.id),
    title: textOrEmpty(product.title) || 'Untitled boutique piece',
    description: textOrEmpty(product.description) || 'A thoughtfully curated piece from this boutique collection.',
    imageUrl: textOrEmpty(product.image_url ?? product.image),
    category,
    occasion,
    audience,
    region,
    vibeTags,
    price,
    compareAtPrice,
    discountPercent: compareAtPrice ? Math.round((1 - price / compareAtPrice) * 100) : null,
    stockQuantity: quantity,
    stockState: outOfStock ? 'out' : limitedStock ? 'limited' : 'available',
    confidence: Math.min(100, Math.max(0, Math.round(confidence))),
    priceRecommendation,
    generatedIn: `${generatedSeconds.toFixed(1)}s`,
    insight: textOrEmpty(product.ai_insight ?? product.merchandising_insight ?? product.insight) || FALLBACK_INSIGHT,
    aiGenerated: product.ai_generated !== false,
    createdAt: product.created_at || null,
  };
}

function normalizeStore(store) {
  return {
    name: textOrEmpty(store?.store_name ?? store?.name) || 'Anya boutique',
    slug: textOrEmpty(store?.store_slug ?? store?.slug),
    tagline: textOrEmpty(store?.tagline),
    phone: textOrEmpty(store?.whatsapp_number ?? store?.phone) || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
    haggleMode: Boolean(store?.haggle_mode),
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

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !product || product.is_active === false) return null;

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('id', product.store_id)
      .maybeSingle();

    return {
      product: normalizeProduct(product, store),
      store: normalizeStore(store),
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
    image: data.product.imageUrl ? [data.product.imageUrl] : undefined,
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
