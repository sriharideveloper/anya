import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    const { data: savedProduct, error: productError } = await admin
      .from('products')
      .insert({
        store_id: store.id,
        image_url: publicData.publicUrl,
        title,
        description,
        price,
        category: product?.category?.trim() || 'Boutique edit',
        vibe_tags: Array.isArray(product?.vibeTags) ? product.vibeTags.slice(0, 8) : [],
        ai_generated: true,
        is_active: true,
      })
      .select('*')
      .single();

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
