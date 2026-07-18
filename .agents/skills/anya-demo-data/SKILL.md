# Anya AI — Demo Seed Data & Test Scripts

> Use these to seed your demo with beautiful products.
> Run in browser console or as a script.

---

## Seed Products (Run in Supabase SQL Editor)

```sql
-- DEMO SEED DATA
-- Replace 'YOUR_STORE_ID' with your actual store UUID

-- Product 1: Premium Kanjivaram Saree
INSERT INTO products (store_id, image_url, title, description, price, category, occasion, vibe_tags, color_palette, ai_generated)
VALUES (
  'YOUR_STORE_ID',
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800',
  'Rose Blossom Kanjivaram',
  'A stunning handwoven Kanjivaram silk saree featuring intricate rose motifs in rich crimson and gold. Perfect for weddings, temple visits, and festive celebrations. The luxurious zari work adds an ethereal glow that photographs beautifully.',
  4500,
  'Saree',
  'Wedding',
  ARRAY['Kalyanam Ready', 'Temple Collection', 'Premium Silk', 'Festive Glow'],
  '{"primary": "#8B0000", "secondary": "#FFD700", "accent": "#FFFFFF"}'::jsonb,
  true
);

-- Product 2: Elegant Kurti
INSERT INTO products (store_id, image_url, title, description, price, category, occasion, vibe_tags, color_palette, ai_generated)
VALUES (
  'YOUR_STORE_ID',
  'https://images.unsplash.com/photo-1594463750939-ebb28c3f7f75?w=800',
  'Midnight Elegance Kurti',
  'A contemporary straight-cut kurti in deep midnight blue with delicate silver threadwork along the neckline. Effortlessly transitions from office meetings to evening gatherings. Crafted from premium cotton blend for all-day comfort.',
  1899,
  'Kurti',
  'Office',
  ARRAY['Boss Lady', 'Everyday Elegance', 'Minimal Luxury', 'Workwear Chic'],
  '{"primary": "#191970", "secondary": "#C0C0C0", "accent": "#F5F5F5"}'::jsonb,
  true
);

-- Product 3: Onam Special
INSERT INTO products (store_id, image_url, title, description, price, category, occasion, vibe_tags, color_palette, ai_generated)
VALUES (
  'YOUR_STORE_ID',
  'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=800',
  'Golden Harvest Kasavu',
  'The quintessential Kerala kasavu saree reimagined with contemporary gold borders and a pristine cream base. A celebration of tradition meeting modern elegance. Handloom perfection for Onam, Vishu, and every festive moment.',
  2899,
  'Saree',
  'Onam',
  ARRAY['Onam Special', 'Kerala Heritage', 'Golden Hour', 'Festival Ready'],
  '{"primary": "#FFFDD0", "secondary": "#DAA520", "accent": "#8B4513"}'::jsonb,
  true
);
```

---

## Create Demo Store (SQL)

```sql
-- First, get your user ID from auth.users after signing in
-- Then create your store:

INSERT INTO stores (owner_id, store_name, whatsapp_number, store_slug, tagline, haggle_mode)
VALUES (
  'YOUR_AUTH_USER_ID',      -- Replace with your auth.users UUID
  'Lakshmi Boutique',
  '919876543210',           -- Replace with actual WhatsApp number
  'lakshmi-boutique',
  'Where tradition meets elegance ✨',
  true                      -- Enable haggle mode for demo!
);
```

---

## Test Checklist Script

```javascript
// Run this in browser console to test your setup

async function testAnyaAI() {
  const results = [];
  
  // Test 1: Supabase connection
  try {
    const res = await fetch('/api/health');
    results.push({ test: 'Supabase Connection', pass: res.ok });
  } catch (e) {
    results.push({ test: 'Supabase Connection', pass: false, error: e.message });
  }
  
  // Test 2: Products load
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data, error } = await supabase.from('products').select('count');
    results.push({ test: 'Products Table', pass: !error, count: data });
  } catch (e) {
    results.push({ test: 'Products Table', pass: false, error: e.message });
  }
  
  // Test 3: WhatsApp URL
  try {
    const { generateWhatsAppURL } = await import('@/lib/whatsapp');
    const url = generateWhatsAppURL({
      phone: '919876543210',
      productTitle: 'Test Product',
      price: 1000,
    });
    results.push({ test: 'WhatsApp URL', pass: url.includes('wa.me'), url });
  } catch (e) {
    results.push({ test: 'WhatsApp URL', pass: false, error: e.message });
  }
  
  console.table(results);
  return results;
}

testAnyaAI();
```

---

## Quick Demo Flow Script

For the live demo, follow this exact sequence:

1. **Open landing page** → Show scroll animations
2. **Click "Get Started"** → Sign in with Google
3. **Dashboard** → Click upload zone
4. **Upload a saree photo** → Watch the loading animation
5. **See AI results** → "Look at that name! Rose Blossom Kanjivaram!"
6. **Open storefront** → `/shop/lakshmi-boutique`
7. **Show product cards** → Point out vibe tags, Just Dropped badge
8. **Type in search**: "I need something for Onam below 3000" → Show AI filters
9. **Click Buy** → Show WhatsApp pre-filled message
10. **Toggle Haggle Mode** → Click Buy again → Show haggle message
11. **Drop the mic line**: "Kerala already shops on WhatsApp. We simply gave every boutique an AI-powered storefront."
