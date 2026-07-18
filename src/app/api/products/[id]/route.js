import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function requiresCommerceUpgrade(error) {
  const errorText = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
  const missingPremiumField = /stock_quantity|compare_at_price/.test(errorText);
  const missingColumn =
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    /column.+does not exist|schema cache/i.test(errorText);
  return missingPremiumField && missingColumn;
}

function productImagePath(imageUrl) {
  if (typeof imageUrl !== 'string' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return '';

  try {
    const image = new URL(imageUrl);
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (image.origin !== supabase.origin) return '';

    const prefixes = [
      '/storage/v1/object/public/product-images/',
      '/storage/v1/object/sign/product-images/',
    ];
    const prefix = prefixes.find((candidate) => image.pathname.startsWith(candidate));
    if (!prefix) return '';

    const path = decodeURIComponent(image.pathname.slice(prefix.length));
    if (!path || path.startsWith('/') || path.split('/').some((segment) => segment === '.' || segment === '..')) {
      return '';
    }
    return path;
  } catch {
    return '';
  }
}

function productUpdates(body) {
  const updates = {};

  if (hasOwn(body, 'title')) {
    if (typeof body.title !== 'string') {
      return { error: 'Product title must be text.' };
    }
    const title = body.title.trim();
    if (!title || title.length > 160) {
      return { error: 'Product title must be between 1 and 160 characters.' };
    }
    updates.title = title;
  }

  if (hasOwn(body, 'description')) {
    if (body.description != null && typeof body.description !== 'string') {
      return { error: 'Product description must be text.' };
    }
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length > 5000) {
      return { error: 'Product description must be 5,000 characters or fewer.' };
    }
    updates.description = description || null;
  }

  if (hasOwn(body, 'category')) {
    if (body.category != null && typeof body.category !== 'string') {
      return { error: 'Category must be text.' };
    }
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (category.length > 100) {
      return { error: 'Category must be 100 characters or fewer.' };
    }
    updates.category = category || null;
  }

  if (hasOwn(body, 'occasion')) {
    if (body.occasion != null && typeof body.occasion !== 'string') {
      return { error: 'Occasion must be text.' };
    }
    const occasion = typeof body.occasion === 'string' ? body.occasion.trim() : '';
    if (occasion.length > 100) {
      return { error: 'Occasion must be 100 characters or fewer.' };
    }
    updates.occasion = occasion || null;
  }

  if (hasOwn(body, 'vibeTags')) {
    if (!Array.isArray(body.vibeTags) || body.vibeTags.length > 8) {
      return { error: 'Vibe tags must be an array of up to 8 tags.' };
    }
    if (body.vibeTags.some((tag) => typeof tag !== 'string' || tag.trim().length > 40)) {
      return { error: 'Each vibe tag must be text with 40 characters or fewer.' };
    }
    updates.vibe_tags = [...new Set(body.vibeTags.map((tag) => tag.trim()).filter(Boolean))];
  }

  if (hasOwn(body, 'stockQuantity')) {
    if (body.stockQuantity === '' || body.stockQuantity == null) {
      return { error: 'Stock quantity must be a non-negative whole number.' };
    }
    const stockQuantity = Number(body.stockQuantity);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
      return { error: 'Stock quantity must be a non-negative whole number.' };
    }
    updates.stock_quantity = stockQuantity;
  }

  if (hasOwn(body, 'price')) {
    if (body.price === '' || body.price == null) {
      return { error: 'Price must be a non-negative amount.' };
    }
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 99999999.99) {
      return { error: 'Price must be a non-negative amount.' };
    }
    updates.price = price;
  }

  if (hasOwn(body, 'compareAtPrice')) {
    if (body.compareAtPrice === '' || body.compareAtPrice == null) {
      updates.compare_at_price = null;
    } else {
      const compareAtPrice = Number(body.compareAtPrice);
      if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0 || compareAtPrice > 99999999.99) {
        return { error: 'The original price must be a non-negative amount.' };
      }
      updates.compare_at_price = compareAtPrice;
    }
  }

  if (hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return { error: 'Product availability must be true or false.' };
    }
    updates.is_active = body.isActive;
  }

  if (!Object.keys(updates).length) {
    return { error: 'Choose at least one product field to update.' };
  }

  return { updates };
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id || '')) {
      return NextResponse.json({ error: 'Choose a valid product.' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Send a valid product update.' }, { status: 400 });
    }

    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Sign in again before updating this product.' }, { status: 401 });
    }

    const required = [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ];
    if (required.some((value) => !value)) {
      return NextResponse.json({ error: 'Server-side Supabase updates are not configured.' }, { status: 503 });
    }

    const parsedUpdates = productUpdates(body);
    if (parsedUpdates.error) {
      return NextResponse.json({ error: parsedUpdates.error }, { status: 400 });
    }

    const userClient = supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Your session expired. Sign in and try again.' }, { status: 401 });
    }

    const admin = supabaseClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, store_id')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Product ownership lookup failed:', productError);
      return NextResponse.json({ error: 'The product could not be checked.' }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id')
      .eq('id', product.store_id)
      .eq('owner_id', userData.user.id)
      .maybeSingle();

    if (storeError) {
      console.error('Store ownership lookup failed:', storeError);
      return NextResponse.json({ error: 'The storefront could not be checked.' }, { status: 500 });
    }
    if (!store) {
      return NextResponse.json({ error: 'This product does not belong to the signed-in seller.' }, { status: 403 });
    }

    const { data: updatedProduct, error: updateError } = await admin
      .from('products')
      .update(parsedUpdates.updates)
      .eq('id', product.id)
      .eq('store_id', store.id)
      .select('*')
      .maybeSingle();

    if (updateError) {
      console.error('Product update failed:', updateError);
      if (requiresCommerceUpgrade(updateError)) {
        return NextResponse.json(
          { error: 'Stock and discount fields are not installed yet. Run premium-commerce-upgrade.sql in Supabase.' },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'The product could not be updated.' }, { status: 500 });
    }
    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    console.error('Product update failed:', error);
    return NextResponse.json({ error: 'The product could not be updated.' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id || '')) {
      return NextResponse.json({ error: 'Choose a valid product.' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Send a valid JSON request.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Send a valid product deletion request.' }, { status: 400 });
    }

    const accessToken = typeof body.accessToken === 'string' ? body.accessToken.trim() : '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Sign in again before deleting this product.' }, { status: 401 });
    }

    const required = [
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ];
    if (required.some((value) => !value)) {
      return NextResponse.json({ error: 'Server-side Supabase deletion is not configured.' }, { status: 503 });
    }

    const userClient = supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Your session expired. Sign in and try again.' }, { status: 401 });
    }

    const admin = supabaseClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: product, error: productError } = await admin
      .from('products')
      .select('id, store_id, image_url')
      .eq('id', id)
      .maybeSingle();

    if (productError) {
      console.error('Product deletion lookup failed:', productError);
      return NextResponse.json({ error: 'The product could not be checked.' }, { status: 500 });
    }
    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id')
      .eq('id', product.store_id)
      .eq('owner_id', userData.user.id)
      .maybeSingle();

    if (storeError) {
      console.error('Store deletion ownership lookup failed:', storeError);
      return NextResponse.json({ error: 'The storefront could not be checked.' }, { status: 500 });
    }
    if (!store) {
      return NextResponse.json({ error: 'This product does not belong to the signed-in seller.' }, { status: 403 });
    }

    const imagePath = productImagePath(product.image_url);
    const { data: deletedProduct, error: deleteError } = await admin
      .from('products')
      .delete()
      .eq('id', product.id)
      .eq('store_id', store.id)
      .select('id')
      .maybeSingle();

    if (deleteError) {
      console.error('Product deletion failed:', deleteError);
      return NextResponse.json({ error: 'The product could not be deleted.' }, { status: 500 });
    }
    if (!deletedProduct) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (imagePath) {
      const { error: storageError } = await admin.storage.from('product-images').remove([imagePath]);
      if (storageError) {
        console.error('Deleted product image cleanup failed:', storageError);
      }
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Product deletion failed:', error);
    return NextResponse.json({ error: 'The product could not be deleted.' }, { status: 500 });
  }
}
