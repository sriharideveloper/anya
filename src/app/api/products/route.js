import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_MEDIA_BUCKET = 'product-images';
const PRIVATE_MEDIA_BUCKETS = new Set(['product-references', 'product-reference-images']);
const ALLOWED_MEDIA_BUCKETS = new Set([PUBLIC_MEDIA_BUCKET, ...PRIVATE_MEDIA_BUCKETS]);
const OPTIONAL_PRODUCT_COLUMNS = [
  'category_path',
  'audience_tags',
  'attributes',
  'detection_confidence',
  'compare_at_price',
  'stock_quantity',
  'occasion',
];

function supabaseClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function errorText(error) {
  return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
}

function missingOptionalColumn(error, values) {
  const text = errorText(error);
  const isMissingColumn =
    error?.code === 'PGRST204' ||
    error?.code === '42703' ||
    /column.+does not exist|schema cache/i.test(text);

  if (!isMissingColumn) return '';
  return OPTIONAL_PRODUCT_COLUMNS.find((column) => hasOwn(values, column) && text.includes(column)) || '';
}

function optionalRelationMissing(error) {
  const text = errorText(error);
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation.+does not exist|could not find the table|schema cache/i.test(text)
  );
}

function sanitizeList(value, { maxItems = 12, maxLength = 80 } = {}) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Expected a list of text values.');

  const result = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, maxItems);
  if (result.some((item) => item.length > maxLength)) {
    throw new Error(`List values must be ${maxLength} characters or fewer.`);
  }
  return result;
}

function sanitizeAttributes(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Product attributes must be a set of named values.');
  }

  const attributes = Object.fromEntries(
    Object.entries(value)
      .slice(0, 40)
      .map(([key, item]) => [String(key).trim().slice(0, 80), item])
      .filter(([key]) => key),
  );

  if (JSON.stringify(attributes).length > 20000) {
    throw new Error('Product attributes are too large.');
  }
  return attributes;
}

function normalizeConfidence(value) {
  if (value === '' || value == null) return null;
  let confidence = Number(value);
  if (!Number.isFinite(confidence)) throw new Error('Detection confidence must be a number.');
  if (confidence > 1 && confidence <= 100) confidence /= 100;
  if (confidence < 0 || confidence > 1) throw new Error('Detection confidence must be between 0 and 1.');
  return confidence;
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

function parseStorageUrl(value) {
  if (typeof value !== 'string' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const image = new URL(value);
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (image.origin !== supabase.origin) return null;

    const match = image.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;

    const bucket = decodeURIComponent(match[1]);
    const path = decodeURIComponent(match[2]);
    if (
      !ALLOWED_MEDIA_BUCKETS.has(bucket) ||
      !path ||
      path.startsWith('/') ||
      path.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      return null;
    }
    return { bucket, path };
  } catch {
    return null;
  }
}

function normalizeMedia(media, userId, imageUrl) {
  if (!Array.isArray(media) || media.length < 1 || media.length > 8) {
    throw new Error('Publish between one and eight verified product images.');
  }

  const normalized = [];
  const seen = new Set();

  for (const [index, item] of media.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Product media is invalid.');
    }

    const bucket = String(item.bucket || '').trim();
    const path = String(item.path || '').trim();
    if (
      !ALLOWED_MEDIA_BUCKETS.has(bucket) ||
      !path.startsWith(`${userId}/`) ||
      path.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error('Product media must use the signed-in seller’s storage path.');
    }

    const key = `${bucket}/${path}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const isVisible = Boolean(item.isVisible);
    const publicUrl = typeof item.publicUrl === 'string' ? item.publicUrl.trim() : '';
    if (isVisible) {
      const parsedUrl = parseStorageUrl(publicUrl);
      if (bucket !== PUBLIC_MEDIA_BUCKET || !parsedUrl || parsedUrl.bucket !== bucket || parsedUrl.path !== path) {
        throw new Error('Visible product media must use a valid public product-images URL.');
      }
    }

    normalized.push({
      bucket,
      path,
      publicUrl: isVisible ? publicUrl : '',
      kind: item.kind === 'ai_visual' ? 'ai_visual' : item.kind === 'seller_storefront' ? 'seller_storefront' : 'seller_reference',
      isVisible,
      isCover: Boolean(item.isCover),
      sortOrder: Number.isInteger(Number(item.sortOrder)) && Number(item.sortOrder) >= 0
        ? Number(item.sortOrder)
        : index,
    });
  }

  if (normalized.filter((item) => item.kind === 'seller_reference').length > 3) {
    throw new Error('Use no more than three active product references.');
  }

  const parsedCover = parseStorageUrl(imageUrl);
  if (!parsedCover || parsedCover.bucket !== PUBLIC_MEDIA_BUCKET || !parsedCover.path.startsWith(`${userId}/`)) {
    throw new Error('Choose a verified public storefront cover.');
  }

  const matchingCover = normalized.find(
    (item) => item.isVisible && item.bucket === parsedCover.bucket && item.path === parsedCover.path,
  );
  if (!matchingCover) throw new Error('The storefront cover must be part of the visible gallery.');

  normalized.forEach((item) => {
    item.isCover = item === matchingCover;
  });
  return normalized;
}

async function assertStoredMedia(admin, media) {
  for (const item of media) {
    const separator = item.path.lastIndexOf('/');
    const folder = item.path.slice(0, separator);
    const filename = item.path.slice(separator + 1);
    const { data, error } = await admin.storage.from(item.bucket).list(folder, {
      limit: 10,
      search: filename,
    });
    if (error || !data?.some((object) => object.name === filename)) {
      throw new Error('One or more uploaded product images could not be verified. Upload them again.');
    }
  }
}

function validateProduct(product) {
  if (!product || typeof product !== 'object' || Array.isArray(product)) {
    throw new Error('Add valid product details before publishing.');
  }

  const title = typeof product.title === 'string' ? product.title.trim() : '';
  const description = typeof product.description === 'string' ? product.description.trim() : '';
  if (!title || title.length > 160) throw new Error('Product title must be between 1 and 160 characters.');
  if (!description || description.length > 5000) {
    throw new Error('Add a product description of 5,000 characters or fewer.');
  }

  if (!hasOwn(product, 'price') || product.price === '' || product.price == null) {
    throw new Error('Confirm the seller’s actual price before publishing.');
  }
  const price = Number(product.price);
  if (!Number.isFinite(price) || price < 0 || price > 99999999.99) {
    throw new Error('Confirm a valid non-negative selling price.');
  }

  if (!hasOwn(product, 'stockQuantity') || product.stockQuantity === '' || product.stockQuantity == null) {
    throw new Error('Confirm the seller’s actual stock before publishing.');
  }
  const stockQuantity = Number(product.stockQuantity);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
    throw new Error('Stock quantity must be a non-negative whole number.');
  }

  let compareAtPrice = null;
  if (hasOwn(product, 'compareAtPrice') && product.compareAtPrice !== '' && product.compareAtPrice != null) {
    compareAtPrice = Number(product.compareAtPrice);
    if (!Number.isFinite(compareAtPrice) || compareAtPrice < 0 || compareAtPrice > 99999999.99) {
      throw new Error('The original price must be a non-negative amount.');
    }
  }

  const category = typeof product.category === 'string' ? product.category.trim() : '';
  const occasion = typeof product.occasion === 'string' ? product.occasion.trim() : '';
  if (category.length > 160 || occasion.length > 160) {
    throw new Error('Category and occasion must be 160 characters or fewer.');
  }

  return {
    publicValues: {
      title,
      description,
      price,
      compare_at_price: compareAtPrice,
      stock_quantity: stockQuantity,
      category: category || 'Boutique edit',
      vibe_tags: sanitizeList(product.vibeTags, { maxItems: 8, maxLength: 40 }),
      occasion: occasion || null,
      category_path: sanitizeList(product.categoryPath, { maxItems: 8, maxLength: 120 }),
      audience_tags: sanitizeList(product.audienceTags, { maxItems: 12, maxLength: 80 }),
      attributes: sanitizeAttributes(product.attributes),
      detection_confidence: normalizeConfidence(product.confidence),
    },
    metadata: {
      analysis: {
        category: category || 'Boutique edit',
        category_path: sanitizeList(product.categoryPath, { maxItems: 8, maxLength: 120 }),
        audience_tags: sanitizeList(product.audienceTags, { maxItems: 12, maxLength: 80 }),
        attributes: sanitizeAttributes(product.attributes),
        detection_confidence: normalizeConfidence(product.confidence),
        target_audience: typeof product.targetAudience === 'string' ? product.targetAudience.trim().slice(0, 500) : '',
        visual_generation_brief:
          product.visualGenerationBrief && typeof product.visualGenerationBrief === 'object'
            ? product.visualGenerationBrief
            : {},
      },
      seller_insight: {
        text: typeof product.insight === 'string' ? product.insight.trim().slice(0, 2000) : '',
      },
      price_suggestion: {
        currency: 'INR',
        amount: Number.isFinite(Number(product.priceSuggestion)) ? Number(product.priceSuggestion) : null,
        confidence: normalizeConfidence(product.priceSuggestionConfidence ?? product.confidence),
        is_suggestion_only: true,
      },
      model_name: typeof product.modelName === 'string' ? product.modelName.trim().slice(0, 120) : null,
      prompt_version: typeof product.promptVersion === 'string' ? product.promptVersion.trim().slice(0, 120) : null,
    },
  };
}

function validateVariants(productId, variants) {
  if (variants == null) return [];
  if (!Array.isArray(variants) || variants.length > 100) {
    throw new Error('Product variants must be a list of at most 100 seller-confirmed options.');
  }

  return variants.map((variant, index) => {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
      throw new Error('A product variant is invalid.');
    }
    const optionValues = sanitizeAttributes(variant.optionValues ?? variant.option_values ?? variant.options);
    if (!Object.keys(optionValues).length) throw new Error('Every variant needs at least one option.');

    const stockQuantity = Number(variant.stockQuantity ?? variant.stock_quantity);
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
      throw new Error('Variant stock must be a non-negative whole number.');
    }

    const price = variant.price === '' || variant.price == null ? null : Number(variant.price);
    const compareAtPrice =
      variant.compareAtPrice === '' || variant.compareAtPrice == null ? null : Number(variant.compareAtPrice);
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 99999999.99)) {
      throw new Error('Variant price must be a non-negative amount.');
    }
    if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0 || compareAtPrice > 99999999.99)) {
      throw new Error('Variant original price must be a non-negative amount.');
    }

    return {
      product_id: productId,
      option_values: optionValues,
      stock_quantity: stockQuantity,
      price,
      compare_at_price: compareAtPrice,
      sku: typeof variant.sku === 'string' ? variant.sku.trim().slice(0, 160) || null : null,
      is_active: variant.isActive !== false,
      sort_order: Number.isInteger(Number(variant.sortOrder)) && Number(variant.sortOrder) >= 0
        ? Number(variant.sortOrder)
        : index,
    };
  });
}

async function insertProduct(admin, productValues) {
  const values = { ...productValues };

  for (let attempt = 0; attempt <= OPTIONAL_PRODUCT_COLUMNS.length; attempt += 1) {
    const result = await admin.from('products').insert(values).select('*').single();
    if (!result.error) return result;

    const missingColumn = missingOptionalColumn(result.error, values);
    if (!missingColumn) return result;
    delete values[missingColumn];
  }

  return { data: null, error: new Error('Product fields could not be saved.') };
}

async function insertOptional(admin, table, rows, options = {}) {
  if (!rows || (Array.isArray(rows) && !rows.length)) return { data: [], error: null };
  const query = options.upsert
    ? admin.from(table).upsert(rows, options.upsert)
    : admin.from(table).insert(rows);
  const result = options.select ? await query.select(options.select) : await query;
  if (result.error && !optionalRelationMissing(result.error)) {
    console.error(`Optional ${table} persistence failed:`, result.error);
  }
  return result;
}

function mediaRows(productId, media) {
  return media.map((item) => ({
    product_id: productId,
    storage_bucket: item.bucket,
    storage_path: item.path,
    legacy_image_url: item.publicUrl || null,
    origin: item.kind === 'ai_visual' ? 'ai' : 'seller',
    use_as_generation_reference: item.kind === 'seller_reference',
    is_storefront_visible: item.isVisible,
    is_primary: item.isCover,
    sort_order: item.sortOrder,
    metadata: { source_kind: item.kind },
  }));
}

async function persistOptionalProductData(admin, {
  product,
  savedProduct,
  storeId,
  userId,
  media,
  metadata,
  generation,
}) {
  const mediaResult = await insertOptional(admin, 'product_media', mediaRows(savedProduct.id, media), {
    select: 'id, origin, use_as_generation_reference',
  });
  const savedMedia = mediaResult.error ? [] : mediaResult.data || [];

  await insertOptional(admin, 'product_ai_metadata', {
    product_id: savedProduct.id,
    ...metadata,
    model_name: metadata.model_name || (typeof generation?.modelName === 'string' ? generation.modelName.slice(0, 120) : null),
    prompt_version:
      metadata.prompt_version ||
      (typeof generation?.promptVersion === 'string' ? generation.promptVersion.slice(0, 120) : null),
  }, {
    upsert: { onConflict: 'product_id' },
  });

  const variants = validateVariants(savedProduct.id, product.variants);
  await insertOptional(admin, 'product_variants', variants);

  const aiMediaIds = savedMedia.filter((item) => item.origin === 'ai').map((item) => item.id);
  const referenceMediaIds = savedMedia
    .filter((item) => item.use_as_generation_reference)
    .map((item) => item.id)
    .slice(0, 3);
  const requestedCandidate = Number(generation?.requestedCount);
  const requestedCount = Number.isInteger(requestedCandidate)
    ? Math.min(5, Math.max(1, requestedCandidate))
    : aiMediaIds.length;

  if (requestedCount > 0) {
    const completedCount = Math.min(aiMediaIds.length, requestedCount);
    const inputHash = createHash('sha256')
      .update(JSON.stringify({
        references: media.filter((item) => item.kind === 'seller_reference').map((item) => `${item.bucket}/${item.path}`),
        category: metadata.analysis.category,
        attributes: metadata.analysis.attributes,
        promptVersion: metadata.prompt_version,
      }))
      .digest('hex');
    const idempotencyKey = `publish:${savedProduct.id}:${inputHash.slice(0, 24)}`;
    const status = completedCount === requestedCount ? 'succeeded' : completedCount ? 'partial' : 'failed';
    const jobResult = await insertOptional(admin, 'product_generation_jobs', {
      product_id: savedProduct.id,
      store_id: storeId,
      requested_by: userId,
      idempotency_key: idempotencyKey,
      input_hash: inputHash,
      reference_media_ids: referenceMediaIds,
      brand_asset_ids: [],
      requested_count: requestedCount,
      completed_count: completedCount,
      status,
      model_name: metadata.model_name || generation?.modelName || null,
      prompt_version: metadata.prompt_version || generation?.promptVersion || null,
      usage_metadata: {
        duration_seconds: Number.isFinite(Number(generation?.durationSeconds))
          ? Number(generation.durationSeconds)
          : null,
        reference_count: Number.isInteger(Number(generation?.referenceCount))
          ? Number(generation.referenceCount)
          : referenceMediaIds.length,
      },
      safe_error_message: completedCount ? null : 'No generated visual was published.',
    }, {
      select: 'id',
    });

    const job = jobResult.error ? null : jobResult.data?.[0] || null;
    if (job && aiMediaIds.length) {
      const { error } = await admin
        .from('product_media')
        .update({ generation_job_id: job.id })
        .in('id', aiMediaIds);
      if (error && !optionalRelationMissing(error)) {
        console.error('Optional product media job link failed:', error);
      }
    }
  }

  return savedMedia;
}

export async function POST(request) {
  let uploadedPath = '';

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Send a valid product publishing request.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Send valid product details.' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization');
    const accessToken =
      (typeof body.accessToken === 'string' ? body.accessToken.trim() : '') ||
      (authorization?.startsWith('Bearer ') ? authorization.slice(7) : '');
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

    const storeId = typeof body.storeId === 'string' ? body.storeId.trim() : '';
    if (!UUID_PATTERN.test(storeId)) {
      return NextResponse.json({ error: 'Choose a valid storefront.' }, { status: 400 });
    }

    let validated;
    try {
      validated = validateProduct(body.product);
      validateVariants('00000000-0000-0000-0000-000000000000', body.product?.variants);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const admin = supabaseClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: store, error: storeError } = await admin
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .eq('owner_id', userData.user.id)
      .maybeSingle();
    if (storeError) {
      console.error('Product storefront ownership lookup failed:', storeError);
      return NextResponse.json({ error: 'The storefront could not be checked.' }, { status: 500 });
    }
    if (!store) {
      return NextResponse.json({ error: 'This storefront does not belong to the signed-in seller.' }, { status: 403 });
    }

    let imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    let normalizedMedia;

    if (imageUrl) {
      try {
        normalizedMedia = normalizeMedia(body.media, userData.user.id, imageUrl);
        await assertStoredMedia(admin, normalizedMedia);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      let decoded;
      try {
        decoded = decodeImage(body.image);
      } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      const extension = decoded.mimeType === 'image/png' ? 'png' : decoded.mimeType === 'image/webp' ? 'webp' : 'jpg';
      uploadedPath = `${userData.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage
        .from(PUBLIC_MEDIA_BUCKET)
        .upload(uploadedPath, decoded.buffer, {
          contentType: decoded.mimeType,
          cacheControl: '31536000',
          upsert: false,
        });
      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      imageUrl = admin.storage.from(PUBLIC_MEDIA_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      normalizedMedia = [{
        bucket: PUBLIC_MEDIA_BUCKET,
        path: uploadedPath,
        publicUrl: imageUrl,
        kind: 'seller_reference',
        isVisible: true,
        isCover: true,
        sortOrder: 0,
      }];
    }

    const { data: savedProduct, error: productError } = await insertProduct(admin, {
      store_id: store.id,
      image_url: imageUrl,
      ...validated.publicValues,
      ai_generated: true,
      is_active: true,
    });

    if (productError) {
      if (uploadedPath) {
        await admin.storage.from(PUBLIC_MEDIA_BUCKET).remove([uploadedPath]);
        uploadedPath = '';
      }
      throw new Error(`Product save failed: ${productError.message}`);
    }

    await persistOptionalProductData(admin, {
      product: body.product,
      savedProduct,
      storeId: store.id,
      userId: userData.user.id,
      media: normalizedMedia,
      metadata: validated.metadata,
      generation: body.generation && typeof body.generation === 'object' ? body.generation : {},
    });

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
      const { data: savedBundle, error: bundleError } = await admin
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
      if (bundleError && !optionalRelationMissing(bundleError)) {
        console.error('Optional bundle persistence failed:', bundleError);
      }
      bundle = savedBundle || null;
    }

    return NextResponse.json({ product: savedProduct, bundle });
  } catch (error) {
    console.error('Product publishing failed:', error);
    return NextResponse.json({ error: error.message || 'The product could not be published.' }, { status: 500 });
  }
}
