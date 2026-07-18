import { createClient } from '@supabase/supabase-js';

export const revalidate = 3600;

function getSiteUrl() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : 'http://localhost:3000')).replace(/\/$/, '');
}

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const home = {
    url: siteUrl,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1,
  };

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [home];
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const [{ data: stores }, { data: products }] = await Promise.all([
      supabase.from('stores').select('store_slug, updated_at').not('store_slug', 'is', null),
      supabase.from('products').select('id, updated_at').eq('is_active', true),
    ]);

    return [
      home,
      ...(stores || []).map((store) => ({
        url: `${siteUrl}/shop?store=${encodeURIComponent(store.store_slug)}`,
        lastModified: store.updated_at ? new Date(store.updated_at) : new Date(),
        changeFrequency: 'daily',
        priority: 0.8,
      })),
      ...(products || []).map((product) => ({
        url: `${siteUrl}/product/${encodeURIComponent(product.id)}`,
        lastModified: product.updated_at ? new Date(product.updated_at) : new Date(),
        changeFrequency: 'daily',
        priority: 0.9,
      })),
    ];
  } catch {
    return [home];
  }
}
