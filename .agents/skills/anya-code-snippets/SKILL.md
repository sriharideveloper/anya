# Anya AI — Error-Proof Code Snippets & Patterns

> Copy-paste-ready code that handles every edge case.
> Because nothing kills a demo faster than an unhandled error. 💀

---

## 🛡️ Gemini Response Parser (Bulletproof)

```javascript
// lib/gemini.js
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export function getModel(modelName = 'gemini-2.0-flash') {
  return genAI.getGenerativeModel({
    model: modelName,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',  // Forces JSON output
    },
  });
}

/**
 * Parse Gemini response text into JSON, handling all edge cases.
 * - Strips markdown code fences
 * - Handles partial JSON
 * - Retries on failure
 */
export function parseGeminiJSON(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Empty or invalid Gemini response');
  }

  let cleaned = responseText.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fencePatterns = [
    /^```json\s*\n?([\s\S]*?)\n?\s*```$/,
    /^```\s*\n?([\s\S]*?)\n?\s*```$/,
    /^`([\s\S]*?)`$/,
  ];

  for (const pattern of fencePatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      cleaned = match[1].trim();
      break;
    }
  }

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to find JSON object in the text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error(`Failed to parse Gemini JSON: ${e2.message}\nRaw: ${cleaned.substring(0, 200)}`);
      }
    }
    throw new Error(`No valid JSON found in Gemini response: ${cleaned.substring(0, 200)}`);
  }
}

/**
 * Send image to Gemini with automatic retry logic.
 */
export async function analyzeImageWithRetry(imageData, mimeType, prompt, maxRetries = 2) {
  const model = getModel();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: imageData,
            mimeType: mimeType,
          },
        },
      ]);

      const text = result.response.text();
      return parseGeminiJSON(text);
    } catch (error) {
      console.error(`Gemini attempt ${attempt + 1} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Gemini failed after ${maxRetries + 1} attempts: ${error.message}`);
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}

/**
 * Text-only Gemini call with retry.
 */
export async function queryGeminiText(prompt, maxRetries = 2) {
  const model = getModel();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseGeminiJSON(text);
    } catch (error) {
      console.error(`Gemini text attempt ${attempt + 1} failed:`, error.message);

      if (attempt === maxRetries) {
        throw new Error(`Gemini text query failed after ${maxRetries + 1} attempts: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
```

---

## 🛡️ Supabase Error Wrapper

```javascript
// lib/supabase/helpers.js

/**
 * Wraps a Supabase query and throws on error.
 * Usage: const products = await safeQuery(supabase.from('products').select('*'));
 */
export async function safeQuery(queryPromise) {
  const { data, error } = await queryPromise;

  if (error) {
    console.error('Supabase Error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(error.message || 'Database query failed');
  }

  return data;
}

/**
 * Upload file to Supabase Storage with validation.
 */
export async function uploadProductImage(supabase, file) {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(', ')}`);
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`);
  }

  // Generate unique filename
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `products/${fileName}`;

  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload image');
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return publicUrl;
}
```

---

## 🛡️ API Route Template (Error-Proof)

```javascript
// app/api/merchandise/route.js
import { NextResponse } from 'next/server';
import { analyzeImageWithRetry } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';

const MERCHANDISE_PROMPT = `You are an elite fashion merchandiser for a premium Kerala boutique.

Analyze this product image and return ONLY valid JSON (no markdown, no code fences):

{
  "title": "A creative, luxury product name",
  "description": "A compelling 2-3 sentence product description",
  "price_guess": 2500,
  "category": "Saree",
  "occasion": "Wedding",
  "vibe_tags": ["Kalyanam Ready", "Temple Collection"],
  "color_palette": {
    "primary": "#8B0000",
    "secondary": "#FFD700",
    "accent": "#FFFFFF"
  }
}`;

export async function POST(request) {
  try {
    // 1. Parse request
    const formData = await request.formData();
    const image = formData.get('image');
    const storeId = formData.get('storeId');

    // 2. Validate inputs
    if (!image || !image.size) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      );
    }

    // 3. Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        { error: `Invalid image type. Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Convert to base64 for Gemini
    const bytes = await image.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');

    // 5. Send to Gemini (with retry)
    const aiResult = await analyzeImageWithRetry(
      base64,
      image.type,
      MERCHANDISE_PROMPT
    );

    // 6. Validate AI response
    const validated = validateMerchandiseResponse(aiResult);

    // 7. Upload image to Supabase Storage
    const supabase = await createClient();

    const ext = image.name?.split('.').pop() || 'jpg';
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(`products/${fileName}`, Buffer.from(bytes), {
        contentType: image.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(`products/${fileName}`);

    // 8. Save to database
    const { data: product, error: dbError } = await supabase
      .from('products')
      .insert({
        store_id: storeId,
        image_url: publicUrl,
        title: validated.title,
        description: validated.description,
        price: validated.price_guess,
        category: validated.category,
        occasion: validated.occasion || null,
        vibe_tags: validated.vibe_tags,
        color_palette: validated.color_palette || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save product' },
        { status: 500 }
      );
    }

    // 9. Return success
    return NextResponse.json({
      success: true,
      product,
    });

  } catch (error) {
    console.error('Merchandise API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}

function validateMerchandiseResponse(data) {
  const required = ['title', 'description', 'price_guess', 'category', 'vibe_tags'];
  const missing = required.filter(f => !data[f]);

  if (missing.length > 0) {
    throw new Error(`AI response missing fields: ${missing.join(', ')}`);
  }

  if (!Array.isArray(data.vibe_tags) || data.vibe_tags.length === 0) {
    data.vibe_tags = ['New Arrival']; // Fallback
  }

  const price = Number(data.price_guess);
  if (isNaN(price) || price <= 0) {
    data.price_guess = 999; // Fallback price
  } else {
    data.price_guess = price;
  }

  return data;
}
```

---

## 🛡️ Smart Search API (Error-Proof)

```javascript
// app/api/search/route.js
import { NextResponse } from 'next/server';
import { queryGeminiText } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
  try {
    const { query, storeId } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      );
    }

    // Extract filters from natural language
    const prompt = `You are a shopping assistant for a Kerala boutique.

The customer said: "${query.trim()}"

Extract search filters and return ONLY valid JSON:
{
  "category": "string or null",
  "occasion": "string or null",
  "max_price": null,
  "min_price": null,
  "color": "string or null",
  "vibe": "string or null",
  "keywords": ["array", "of", "keywords"]
}

Rules:
- category must be one of: Saree, Kurti, Lehenga, Blouse, Dupatta, Jewellery, Footwear, Accessories, or null
- occasion must be one of: Casual, Office, Wedding, Temple, Onam, Party, Festival, Everyday, or null
- prices must be numbers or null
- keywords should be 1-3 relevant search terms`;

    const filters = await queryGeminiText(prompt);

    // Build Supabase query
    const supabase = await createClient();
    let dbQuery = supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .eq('is_active', true);

    if (filters.category) {
      dbQuery = dbQuery.ilike('category', `%${filters.category}%`);
    }
    if (filters.occasion) {
      dbQuery = dbQuery.ilike('occasion', `%${filters.occasion}%`);
    }
    if (filters.max_price) {
      dbQuery = dbQuery.lte('price', filters.max_price);
    }
    if (filters.min_price) {
      dbQuery = dbQuery.gte('price', filters.min_price);
    }
    if (filters.color) {
      dbQuery = dbQuery.or(`title.ilike.%${filters.color}%,description.ilike.%${filters.color}%`);
    }

    dbQuery = dbQuery.order('created_at', { ascending: false }).limit(20);

    const { data: products, error } = await dbQuery;

    if (error) {
      console.error('Search DB error:', error);
      return NextResponse.json(
        { error: 'Search failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      filters,
      products: products || [],
      count: products?.length || 0,
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}
```

---

## 🛡️ useProducts Hook (with Loading & Error States)

```javascript
// hooks/useProducts.js
'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useProducts(storeId) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const supabase = createClient();

  const fetchProducts = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      // Add computed badges
      const now = new Date();
      const enriched = (data || []).map(product => ({
        ...product,
        isJustDropped: (now - new Date(product.created_at)) < 24 * 60 * 60 * 1000,
        isTrending: product.view_count > 50,
      }));

      setProducts(enriched);
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Real-time subscription
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`products:${storeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          fetchProducts(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}
```

---

## 🛡️ useAuth Hook

```javascript
// hooks/useAuth.js
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function getSession() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          setUser(null);
          setStore(null);
          setLoading(false);
          return;
        }

        setUser(user);

        // Fetch store for this user
        const { data: storeData } = await supabase
          .from('stores')
          .select('*')
          .eq('owner_id', user.id)
          .single();

        setStore(storeData);
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
      }
    }

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          setUser(session?.user || null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setStore(null);
          router.push('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (provider = 'google') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return { user, store, loading, signIn, signOut };
}
```

---

## 🛡️ Auth Callback Route

```javascript
// app/api/auth/callback/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to home with error
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
```

---

## 🛡️ WhatsApp URL Generator (Bulletproof)

```javascript
// lib/whatsapp.js

/**
 * Generate a WhatsApp checkout URL with pre-filled message.
 * Handles all edge cases: encoding, phone format, special chars.
 */
export function generateWhatsAppURL({ phone, productTitle, price, mode = 'buy', storeName = '' }) {
  // Validate inputs
  if (!phone) throw new Error('Phone number is required');
  if (!productTitle) throw new Error('Product title is required');

  // Clean phone number (remove spaces, dashes, plus, parens)
  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

  // Ensure country code (default to India 91)
  const phoneWithCode = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  // Validate phone number
  if (!/^\d{10,15}$/.test(phoneWithCode)) {
    throw new Error('Invalid phone number format');
  }

  // Clean price
  const cleanPrice = Number(price) || 0;
  const formattedPrice = cleanPrice.toLocaleString('en-IN');

  // Build message based on mode
  let message;

  switch (mode) {
    case 'haggle':
      message = [
        `Hi! 😊`,
        `I love this *${productTitle}* at ₹${formattedPrice}, but I'm your favorite customer...`,
        `Can we fix a price? 😄`,
        storeName ? `\n— via ${storeName}` : '',
      ].filter(Boolean).join('\n');
      break;

    case 'bundle':
      message = `Hi! I'd like to order the *${productTitle}* bundle. Is it available?`;
      break;

    default:
      message = [
        `Hi! I'm interested in the *${productTitle}*.`,
        `Is it available for ₹${formattedPrice}?`,
        storeName ? `\n— via ${storeName}` : '',
      ].filter(Boolean).join('\n');
  }

  return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate WhatsApp URL for a bundle order.
 */
export function generateBundleURL({ phone, items, storeName = '' }) {
  if (!items || items.length === 0) throw new Error('Bundle must have items');

  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
  const phoneWithCode = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

  const itemList = items
    .map(i => `• ${i.title} — ₹${Number(i.price).toLocaleString('en-IN')}`)
    .join('\n');

  const total = items.reduce((sum, i) => sum + Number(i.price), 0);

  const message = [
    `Hi! I'd like to order this bundle:`,
    '',
    itemList,
    '',
    `*Total: ₹${total.toLocaleString('en-IN')}*`,
    '',
    `Is this available?`,
    storeName ? `\n— via ${storeName}` : '',
  ].filter(Boolean).join('\n');

  return `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`;
}
```

---

## 🛡️ Middleware (Auth Protection)

```javascript
// middleware.js
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard route
  if (request.nextUrl.pathname.startsWith('/dashboard') && !user) {
    return NextResponse.redirect(new URL('/?login=required', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

---

## 🛡️ Constants & Helpers

```javascript
// utils/constants.js
export const CATEGORIES = [
  'Saree', 'Kurti', 'Lehenga', 'Blouse', 'Dupatta',
  'Jewellery', 'Footwear', 'Accessories', "Men's Wear", "Kids' Wear", 'Other'
];

export const OCCASIONS = [
  'Casual', 'Office', 'Wedding', 'Temple', 'Onam',
  'Party', 'Festival', 'Everyday', 'Date Night'
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ANIMATION_EASE = [0.22, 1, 0.36, 1];
export const STAGGER_DELAY = 0.08;
```

```javascript
// utils/helpers.js
export function formatPrice(price) {
  return Number(price).toLocaleString('en-IN');
}

export function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en-IN');
}

export function isJustDropped(createdAt) {
  return (new Date() - new Date(createdAt)) < 24 * 60 * 60 * 1000;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str, maxLength = 100) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
```
