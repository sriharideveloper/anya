import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_MEDIA_BUCKET = 'product-images';
const ALLOWED_MEDIA_BUCKETS = new Set([
  PUBLIC_MEDIA_BUCKET,
  'product-references',
  'product-reference-images',
]);
const FLEXIBLE_PRODUCT_COLUMNS = [
  'category_path',
  'audience_tags',
  'attributes',
  'detection_confidence',
];

function supabaseClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authenticatedSupabaseClient(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );
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

function errorText(error) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
}

function optionalRelationMissing(error) {
  const text = errorText(error);
  return (
    error?.code === '42P01' ||
    error?.code === '42883' ||
    error?.code === 'PGRST205' ||
    error?.code === 'PGRST202' ||
    error?.code === 'PGRST204' ||
    /relation.+does not exist|column.+does not exist|could not find the table|schema cache/i.test(text)
  );
}

function missingFlexibleColumn(error, values) {
  const text = errorText(error);
  const isMissingColumn =
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    /column.+does not exist|schema cache/i.test(text);

  if (!isMissingColumn) return '';
  return FLEXIBLE_PRODUCT_COLUMNS.find((column) => hasOwn(values, column) && text.includes(column)) || '';
}

function sanitizeList(value, { maxItems = 12, maxLength = 80 } = {}) {
  if (!Array.isArray(value)) return { error: 'Expected a list of text values.' };
  const result = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, maxItems);
  if (result.some((item) => item.length > maxLength)) {
    return { error: `List values must be ${maxLength} characters or fewer.` };
  }
  return { value: result };
}

function sanitizeAttributes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Product attributes must be a set of named values.' };
  }
  const attributes = Object.fromEntries(
    Object.entries(value)
      .slice(0, 40)
      .map(([key, item]) => [String(key).trim().slice(0, 80), item])
      .filter(([key]) => key),
  );
  if (JSON.stringify(attributes).length > 20000) {
    return { error: 'Product attributes are too large.' };
  }
  return { value: attributes };
}

function normalizeConfidence(value) {
  if (value === '' || value == null) return { value: null };
  let confidence = Number(value);
  if (!Number.isFinite(confidence)) return { error: 'Detection confidence must be a number.' };
  if (confidence > 1 && confidence <= 100) confidence /= 100;
  if (confidence < 0 || confidence > 1) {
    return { error: 'Detection confidence must be between 0 and 1.' };
  }
  return { value: confidence };
}

function storageObjectFromUrl(imageUrl) {
  if (typeof imageUrl !== 'string' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return '';

  try {
    const image = new URL(imageUrl);
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (image.origin !== supabase.origin) return '';

    const match = image.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return '';

    const bucket = decodeURIComponent(match[1]);
    const path = decodeURIComponent(match[2]);
    if (
      !ALLOWED_MEDIA_BUCKETS.has(bucket) ||
      !path ||
      path.startsWith('/') ||
      path.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      return '';
    }
    return { bucket, path };
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
    if (category.length > 160) {
      return { error: 'Category must be 160 characters or fewer.' };
    }
    updates.category = category || null;
  }

  if (hasOwn(body, 'occasion')) {
    if (body.occasion != null && typeof body.occasion !== 'string') {
      return { error: 'Occasion must be text.' };
    }
    const occasion = typeof body.occasion === 'string' ? body.occasion.trim() : '';
    if (occasion.length > 160) {
      return { error: 'Occasion must be 160 characters or fewer.' };
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

  if (hasOwn(body, 'categoryPath')) {
    const parsed = sanitizeList(body.categoryPath, { maxItems: 8, maxLength: 120 });
    if (parsed.error) return parsed;
    updates.category_path = parsed.value;
  }

  if (hasOwn(body, 'audienceTags')) {
    const parsed = sanitizeList(body.audienceTags, { maxItems: 12, maxLength: 80 });
    if (parsed.error) return parsed;
    updates.audience_tags = parsed.value;
  }

  if (hasOwn(body, 'attributes')) {
    const parsed = sanitizeAttributes(body.attributes);
    if (parsed.error) return parsed;
    updates.attributes = parsed.value;
  }

  if (hasOwn(body, 'detectionConfidence') || hasOwn(body, 'confidence')) {
    const parsed = normalizeConfidence(
      hasOwn(body, 'detectionConfidence') ? body.detectionConfidence : body.confidence,
    );
    if (parsed.error) return parsed;
    updates.detection_confidence = parsed.value;
  }

  if (hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      return { error: 'Product availability must be true or false.' };
    }
    updates.is_active = body.isActive;
  }

  const hasMetadataUpdate = [
    'insight',
    'priceSuggestion',
    'modelName',
    'promptVersion',
    'targetAudience',
    'visualGenerationBrief',
    'variants',
  ].some((field) => hasOwn(body, field));

  if (!Object.keys(updates).length && !hasMetadataUpdate) {
    return { error: 'Choose at least one product field to update.' };
  }

  return { updates };
}

function validateVariants(productId, variants) {
  if (!Array.isArray(variants) || variants.length > 100) {
    return { error: 'Product variants must be a list of at most 100 seller-confirmed options.' };
  }

  const rows = [];
  for (const [index, variant] of variants.entries()) {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
      return { error: 'A product variant is invalid.' };
    }

    const parsedOptions = sanitizeAttributes(
      variant.optionValues ?? variant.option_values ?? variant.options,
    );
    if (parsedOptions.error || !Object.keys(parsedOptions.value || {}).length) {
      return { error: 'Every variant needs at least one option.' };
    }

    const stockQuantity = Number(variant.stockQuantity ?? variant.stock_quantity);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
      return { error: 'Variant stock must be a non-negative whole number.' };
    }

    const price = variant.price === '' || variant.price == null ? null : Number(variant.price);
    const compareAtPrice =
      variant.compareAtPrice === '' || variant.compareAtPrice == null
        ? variant.compare_at_price === '' || variant.compare_at_price == null
          ? null
          : Number(variant.compare_at_price)
        : Number(variant.compareAtPrice);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 99999999.99)) {
      return { error: 'Variant price must be a non-negative amount.' };
    }
    if (
      compareAtPrice !== null &&
      (!Number.isFinite(compareAtPrice) || compareAtPrice < 0 || compareAtPrice > 99999999.99)
    ) {
      return { error: 'Variant original price must be a non-negative amount.' };
    }

    rows.push({
      product_id: productId,
      option_values: parsedOptions.value,
      stock_quantity: stockQuantity,
      price,
      compare_at_price: compareAtPrice,
      sku: typeof variant.sku === 'string' ? variant.sku.trim().slice(0, 160) || null : null,
      is_active: variant.isActive !== false && variant.is_active !== false,
      sort_order:
        Number.isInteger(Number(variant.sortOrder ?? variant.sort_order)) &&
        Number(variant.sortOrder ?? variant.sort_order) >= 0
          ? Number(variant.sortOrder ?? variant.sort_order)
          : index,
    });
  }
  return { rows };
}

async function updateProduct(admin, productId, storeId, requestedUpdates) {
  const updates = { ...requestedUpdates };

  for (let attempt = 0; attempt <= FLEXIBLE_PRODUCT_COLUMNS.length; attempt += 1) {
    if (!Object.keys(updates).length) {
      return admin
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('store_id', storeId)
        .maybeSingle();
    }

    const result = await admin
      .from('products')
      .update(updates)
      .eq('id', productId)
      .eq('store_id', storeId)
      .select('*')
      .maybeSingle();
    if (!result.error) return result;

    const missingColumn = missingFlexibleColumn(result.error, updates);
    if (!missingColumn) return result;
    delete updates[missingColumn];
  }

  return { data: null, error: new Error('Product fields could not be updated.') };
}

function metadataPatch(body) {
  const patch = {};

  if (
    hasOwn(body, 'categoryPath') ||
    hasOwn(body, 'audienceTags') ||
    hasOwn(body, 'attributes') ||
    hasOwn(body, 'detectionConfidence') ||
    hasOwn(body, 'confidence') ||
    hasOwn(body, 'targetAudience') ||
    hasOwn(body, 'visualGenerationBrief')
  ) {
    const categoryPath = hasOwn(body, 'categoryPath')
      ? sanitizeList(body.categoryPath, { maxItems: 8, maxLength: 120 }).value || []
      : undefined;
    const audienceTags = hasOwn(body, 'audienceTags')
      ? sanitizeList(body.audienceTags, { maxItems: 12, maxLength: 80 }).value || []
      : undefined;
    const attributes = hasOwn(body, 'attributes') ? sanitizeAttributes(body.attributes).value || {} : undefined;
    const confidence = hasOwn(body, 'detectionConfidence') || hasOwn(body, 'confidence')
      ? normalizeConfidence(hasOwn(body, 'detectionConfidence') ? body.detectionConfidence : body.confidence).value
      : undefined;

    patch.analysis = {
      ...(hasOwn(body, 'category') ? { category: body.category?.trim() || '' } : {}),
      ...(categoryPath !== undefined ? { category_path: categoryPath } : {}),
      ...(audienceTags !== undefined ? { audience_tags: audienceTags } : {}),
      ...(attributes !== undefined ? { attributes } : {}),
      ...(confidence !== undefined ? { detection_confidence: confidence } : {}),
      ...(hasOwn(body, 'targetAudience')
        ? { target_audience: typeof body.targetAudience === 'string' ? body.targetAudience.trim().slice(0, 500) : '' }
        : {}),
      ...(hasOwn(body, 'visualGenerationBrief') &&
      body.visualGenerationBrief &&
      typeof body.visualGenerationBrief === 'object' &&
      !Array.isArray(body.visualGenerationBrief)
        ? { visual_generation_brief: body.visualGenerationBrief }
        : {}),
    };
  }

  if (hasOwn(body, 'insight')) {
    patch.seller_insight = {
      text: typeof body.insight === 'string' ? body.insight.trim().slice(0, 2000) : '',
    };
  }

  if (hasOwn(body, 'priceSuggestion')) {
    const amount =
      body.priceSuggestion === '' || body.priceSuggestion == null ? null : Number(body.priceSuggestion);
    patch.price_suggestion = {
      currency: 'INR',
      amount: Number.isFinite(amount) ? amount : null,
      confidence: normalizeConfidence(body.priceSuggestionConfidence ?? body.confidence).value ?? null,
      is_suggestion_only: true,
    };
  }

  if (hasOwn(body, 'modelName')) {
    patch.model_name = typeof body.modelName === 'string' ? body.modelName.trim().slice(0, 120) || null : null;
  }
  if (hasOwn(body, 'promptVersion')) {
    patch.prompt_version =
      typeof body.promptVersion === 'string' ? body.promptVersion.trim().slice(0, 120) || null : null;
  }
  return patch;
}

async function persistMetadataPatch(admin, productId, body) {
  const patch = metadataPatch(body);
  if (!Object.keys(patch).length) return;

  const { error } = await admin
    .from('product_ai_metadata')
    .upsert({ product_id: productId, ...patch }, { onConflict: 'product_id' });
  if (error && !optionalRelationMissing(error)) {
    console.error('Optional product AI metadata update failed:', error);
  }
}

async function replaceVariants(accessToken, productId, rows) {
  const authenticated = authenticatedSupabaseClient(accessToken);
  const { data, error } = await authenticated.rpc('replace_product_variants', {
    target_product_id: productId,
    replacement_variants: rows,
  });

  if (error && optionalRelationMissing(error)) {
    console.warn('Product variants migration is not installed; the core product update was preserved.');
    return { data: [], unavailable: true };
  }
  return { data: data || [], error };
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
    const parsedVariants = hasOwn(body, 'variants') ? validateVariants(id, body.variants) : null;
    if (parsedVariants?.error) {
      return NextResponse.json({ error: parsedVariants.error }, { status: 400 });
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

    const { data: updatedProduct, error: updateError } = await updateProduct(
      admin,
      product.id,
      store.id,
      parsedUpdates.updates,
    );

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

    await persistMetadataPatch(admin, product.id, body);

    let variants;
    let variantsUnavailable = false;
    if (parsedVariants) {
      const variantResult = await replaceVariants(accessToken, product.id, parsedVariants.rows);
      if (variantResult.error) {
        console.error('Atomic product variant replacement failed:', variantResult.error);
        return NextResponse.json(
          { error: 'The product was updated, but its variants could not be saved. Try again.' },
          { status: 500 },
        );
      }
      variants = variantResult.data;
      variantsUnavailable = Boolean(variantResult.unavailable);
    }

    return NextResponse.json({
      product: variants === undefined ? updatedProduct : { ...updatedProduct, variants },
      ...(variantsUnavailable ? { warning: 'Run product-generalization.sql to enable variants.' } : {}),
    });
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

    const storageObjects = [];
    const { data: mediaRows, error: mediaError } = await admin
      .from('product_media')
      .select('storage_bucket, storage_path, legacy_image_url')
      .eq('product_id', product.id);
    if (mediaError && !optionalRelationMissing(mediaError)) {
      console.error('Product media cleanup lookup failed:', mediaError);
    }

    for (const media of mediaRows || []) {
      const bucket = typeof media.storage_bucket === 'string' ? media.storage_bucket : '';
      const path = typeof media.storage_path === 'string' ? media.storage_path : '';
      if (
        ALLOWED_MEDIA_BUCKETS.has(bucket) &&
        path.startsWith(`${userData.user.id}/`) &&
        !path.split('/').some((segment) => segment === '.' || segment === '..')
      ) {
        storageObjects.push({ bucket, path });
      }

      const legacyObject = storageObjectFromUrl(media.legacy_image_url);
      if (legacyObject && legacyObject.path.startsWith(`${userData.user.id}/`)) {
        storageObjects.push(legacyObject);
      }
    }

    const legacyCover = storageObjectFromUrl(product.image_url);
    if (legacyCover && legacyCover.path.startsWith(`${userData.user.id}/`)) {
      storageObjects.push(legacyCover);
    }

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

    const uniqueStorageObjects = [
      ...new Map(storageObjects.map((item) => [`${item.bucket}/${item.path}`, item])).values(),
    ];
    for (const bucket of [...new Set(uniqueStorageObjects.map((item) => item.bucket))]) {
      const paths = uniqueStorageObjects.filter((item) => item.bucket === bucket).map((item) => item.path);
      const { error: storageError } = await admin.storage.from(bucket).remove(paths);
      if (storageError) console.error(`Deleted ${bucket} cleanup failed:`, storageError);
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Product deletion failed:', error);
    return NextResponse.json({ error: 'The product could not be deleted.' }, { status: 500 });
  }
}
