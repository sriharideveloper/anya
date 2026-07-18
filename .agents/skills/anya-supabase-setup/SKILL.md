---
name: anya-supabase-setup
description: Set up and manage Supabase configuration for Anya AI including authentication, database schema, storage buckets, and Row Level Security policies.
---

# Anya AI — Supabase Setup Skill

## Purpose
Configure Supabase backend for Anya AI: auth, database, storage, and RLS.

## Database Schema

### Table: `stores`
```sql
CREATE TABLE stores (
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
```

### Table: `products`
```sql
CREATE TABLE products (
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
```

### Table: `bundles`
```sql
CREATE TABLE bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommended_product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  recommendation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes
```sql
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_vibe_tags ON products USING GIN(vibe_tags);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_stores_slug ON stores(store_slug);
```

### Views
```sql
CREATE VIEW products_with_badges AS
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
```

## Row Level Security
```sql
-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Stores: owners can CRUD their own
CREATE POLICY "Owners manage their stores"
  ON stores FOR ALL
  USING (auth.uid() = owner_id);

-- Stores: public can read
CREATE POLICY "Public can view stores"
  ON stores FOR SELECT
  USING (true);

-- Products: store owners can CRUD
CREATE POLICY "Store owners manage products"
  ON products FOR ALL
  USING (
    store_id IN (
      SELECT id FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Products: public can read active products
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = true);
```

## Storage Bucket
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

-- Public can view
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
```

## Supabase Client Setup

### Browser Client (`lib/supabase/client.js`)
```javascript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

### Server Client (`lib/supabase/server.js`)
```javascript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

## Error Handling
- Always wrap Supabase calls in try-catch
- Check for `error` in Supabase responses before using `data`
- Return user-friendly error messages, log technical details server-side
- Handle auth session expiry gracefully with redirect to login
