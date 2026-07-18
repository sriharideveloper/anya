# Anya AI — Supabase SQL Setup Script

> Run this ENTIRE script in the Supabase SQL Editor in one go.
> It creates everything: tables, indexes, views, RLS, storage bucket.

---

```sql
-- ============================================================
-- ANYA AI — COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor (one shot)
-- ============================================================

-- 1. TABLES
-- ============================================================

-- Stores table
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  store_slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  tagline TEXT DEFAULT 'Powered by Anya AI',
  theme JSONB DEFAULT '{"accent": "#c9a96e", "mode": "dark"}'::jsonb,
  haggle_mode BOOLEAN DEFAULT false,
  malayalam_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  category TEXT,
  vibe_tags TEXT[] DEFAULT '{}',
  occasion TEXT,
  color_palette JSONB,
  ai_generated BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bundles / Recommendations table
CREATE TABLE IF NOT EXISTS bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommended_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommendation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_vibe_tags ON products USING GIN(vibe_tags);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_occasion ON products(occasion);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(store_slug);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);

-- 3. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW products_with_badges AS
SELECT
  p.*,
  CASE
    WHEN p.created_at > now() - INTERVAL '24 hours' THEN true
    ELSE false
  END AS is_just_dropped,
  CASE
    WHEN p.view_count > 50 THEN true
    ELSE false
  END AS is_trending
FROM products p
WHERE p.is_active = true;

-- 4. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

-- STORES POLICIES

-- Owners can manage their own stores
CREATE POLICY "Owners manage their stores"
  ON stores FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anyone can view stores (public storefront)
CREATE POLICY "Public can view stores"
  ON stores FOR SELECT
  USING (true);

-- PRODUCTS POLICIES

-- Store owners can manage their products
CREATE POLICY "Store owners manage products"
  ON products FOR ALL
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Anyone can view active products (public storefront)
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = true);

-- BUNDLES POLICIES

-- Store owners can manage bundles for their products
CREATE POLICY "Store owners manage bundles"
  ON bundles FOR ALL
  USING (
    product_id IN (
      SELECT p.id FROM products p
      JOIN stores s ON p.store_id = s.id
      WHERE s.owner_id = auth.uid()
    )
  );

-- Anyone can view bundles
CREATE POLICY "Public can view bundles"
  ON bundles FOR SELECT
  USING (true);

-- 5. STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- Anyone can view product images (public)
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- 6. FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Increment view count function
CREATE OR REPLACE FUNCTION increment_view_count(product_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET view_count = view_count + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. REALTIME
-- ============================================================

-- Enable realtime for products (live updates on storefront)
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- ============================================================
-- DONE! Your Anya AI database is ready. 🎉
-- ============================================================
```
