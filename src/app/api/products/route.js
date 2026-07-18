import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const OPTIONAL_PRODUCT_COLUMNS = ['stock_quantity', 'compare_at_price', 'occasion'];

function supabaseClient(key, authorization) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
  });
}

function decodeImage(dataUrl) {
  const match = dataUrl?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) throw new Error('Choose a valid JPEG, PNG or WebP product image.');

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw new Error('The selected image must be under 5 MB.');
  }

  return { buffer, mimeType: match[1] };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function missingOptionalColumn(error) {
  const errorText = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  const isMissingColumn =
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    /column.+does not exist|schema cache/i.test(errorText);

  if (!isMissingColumn) return '';
  return OPTIONAL_PRODUCT_COLUMNS.find((column) => errorText.includes(column)) || '';
}

async function insertProduct(admin, productValues) {
  const values = { ...productValues };

  for (let attempt = 0; attempt <= OPTIONAL_PRODUCT_COLUMNS.length; attempt += 1) {
    const result = await admin.from('products').insert(values).select('*').single();
    if (!result.error) return result;

    const missingColumn = missingOptionalColumn(result.error);
    if (!missingColumn || !hasOwn(values, missingColumn)) return result;
    delete values[missingColumn];
  }

  return { data: null, error: new Error('Product fields could not be saved.') };
}

export async function POST(request) {
  let uploadedPath = '';

  try {
    const authorization = request.headers.get('authorization');
    const body = await request.json();
    const accessToken = body.accessToken || (authorization?.startsWith('Bearer ') ? authorization.slice(7) : '');
    if (!accessToken) {
      return NextResponse.json({ error: 'Sign in again before publishing.' }, { status: 401 });
    }

    const required = [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ];
    if (required.some((value) => !value)) {
      return NextResponse.json({ error: 'Server-side Supabase publishing is not configured.' }, { status: 503 });
    }

    const userClient = supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Your session expired. Sign in and try again.' }, { status: 401 });
    }

    const { storeId, image, product } = body;
    const title = product?.title?.trim();
    const description = product?.description?.trim();
    const price = Number(product?.price);
    if (!storeId || !title || title.length > 160 || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'Add a valid product name and price before publishing.' }, { status: 400 });
    }

    const stockQuantity = hasOwn(product || {}, 'stockQuantity') ? Number(product.stockQuantity) : 1;
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
      return NextResponse.json({ error: 'Stock quantity must be a non-negative whole number.' }, { status: 400 });
    }

    let compareAtPrice = null;
    if (hasOwn(product || {}, 'compareAtPrice') && product.compareAtPrice !== '' && product.compareAtPrice != null) {
      compareAtPrice = Number(product.compareAtPrice);
      if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0) {
        return NextResponse.json({ error: 'The original price must be a non-negative amount.' }, { status: 400 });
      }
    }

    if (hasOwn(product || {}, 'occasion') && product.occasion != null && typeof product.occasion !== 'string') {
      return NextResponse.json({ error: 'Occasion must be text.' }, { status: 400 });
    }
    const occasion = typeof product?.occasion === 'string' ? product.occasion.trim() : '';
    if (occasion.length > 100) {
      return NextResponse.json({ error: 'Occasion must be 100 characters or fewer.' }, { status: 400 });
    }

    const admin = supabaseClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_id', userData.user.id)
      .single();
    if (storeError || !store) {
      return NextResponse.json({ error: 'This storefront does not belong to the signed-in seller.' }, { status: 403 });
    }

    const { buffer, mimeType } = decodeImage(image);
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    uploadedPath = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from('product-images')
      .upload(uploadedPath, buffer, { contentType: mimeType, cacheControl: '31536000', upsert: false });
    if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

    const { data: publicData } = admin.storage.from('product-images').getPublicUrl(uploadedPath);
    const { data: savedProduct, error: productError } = await insertProduct(admin, {
      store_id: store.id,
      image_url: publicData.publicUrl,
      title,
      description,
      price,
      compare_at_price: compareAtPrice,
      stock_quantity: stockQuantity,
      category: product?.category?.trim() || 'Boutique edit',
      vibe_tags: Array.isArray(product?.vibeTags) ? product.vibeTags.slice(0, 8) : [],
      occasion: occasion || null,
      ai_generated: true,
      is_active: true,
    });

    if (productError) {
      await admin.storage.from('product-images').remove([uploadedPath]);
      uploadedPath = '';
      throw new Error(`Product save failed: ${productError.message}`);
    }

    const { data: companion } = await admin
      .from('products')
      .select('id, title')
      .eq('store_id', store.id)
      .neq('id', savedProduct.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let bundle = null;
    if (companion) {
      const { data: savedBundle } = await admin
        .from('bundles')
        .upsert(
          {
            product_id: savedProduct.id,
            recommended_product_id: companion.id,
            recommendation_reason: `${companion.title} complements this new boutique drop.`,
          },
          { onConflict: 'product_id,recommended_product_id' },
        )
        .select('*')
        .single();
      bundle = savedBundle || null;
    }

    return NextResponse.json({ product: savedProduct, bundle });
  } catch (error) {
    console.error('Product publishing failed:', error);
    return NextResponse.json({ error: error.message || 'The product could not be published.' }, { status: 500 });
  }
}
