import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { AiGuardError, authorizeAiRequest } from '@/lib/server/aiGuard';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'gemini-3.5-flash';
const PROMPT_VERSION = 'anya-product-understanding-2.0';
const SCHEMA_VERSION = 'anya.product-understanding.v2';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_REFERENCES = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FORBIDDEN_OUTPUT_KEYS = /^(stock|stock_quantity|inventory|quantity|sku|sizes?|components?|composition|variants?)$/i;

const cache = globalThis.__anyaMerchandiseRequests
  || (globalThis.__anyaMerchandiseRequests = new Map());

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const prompt = `You are Anya, a careful product-understanding assistant for independent sellers.
Analyze 1-3 reference photos that all show the SAME product. Generalize across fashion products:
apparel, jewellery, footwear, bags, accessories, textiles, and other boutique goods.

Return ONLY valid JSON. Use this contract:
{
  "title": "specific but grounded product title",
  "description": "two concise seller-ready sentences based only on visible evidence",
  "classification": {
    "department": "free-form broad department",
    "family": "free-form product family",
    "type": "free-form product type",
    "subtype": "free-form subtype or empty string"
  },
  "attributes": {
    "primaryColor": "visible colour",
    "secondaryColors": ["visible colours"],
    "pattern": "visible pattern or empty string",
    "surfaceDetail": "visible detail or empty string",
    "silhouette": "visible shape or empty string",
    "materialAppearance": "appearance only, e.g. silk-like; never claim fibre composition"
  },
  "occasion": "likely use occasion or empty string",
  "audienceTags": ["broad non-sensitive audience descriptors"],
  "vibeTags": ["3-5 short grounded merchandising tags"],
  "confidence": 0,
  "priceSuggestion": {
    "currency": "INR",
    "recommended": 0,
    "minimum": 0,
    "maximum": 0,
    "reason": "brief seller-only reasoning"
  },
  "insight": "one grounded seller-only merchandising observation",
  "visualBrief": {
    "productIdentity": "what must remain unchanged in generated visuals",
    "styling": "product-appropriate styling",
    "setting": "product-appropriate premium setting",
    "preserve": ["visible details to preserve"],
    "avoid": ["product-specific generation mistakes to avoid"]
  },
  "uncertainties": ["facts the seller should verify"]
}

Rules:
- Classification is hierarchical free-form text. Never force a closed category enum.
- Never invent stock, quantity, SKU, sizes, variants, included components, origin, brand,
  certification, exact fibre composition, craftsmanship technique, or unseen details.
- Describe uncertain material only as visible appearance and add it to uncertainties.
- Price is a seller-only non-binding suggestion, not a fact. Use 0 if confidence is too low.
- Do not sexualize people or infer sensitive traits. Keep all presentation family-safe.
- Seller corrections supplied below are authoritative and must not be contradicted.
- No markdown fences and no prose outside the JSON.`;

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > CACHE_TTL_MS) cache.delete(key);
  }
}

function parseJson(text) {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

function cleanString(value, max = 240) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function cleanList(value, maxItems = 8, maxLength = 60) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanString(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !FORBIDDEN_OUTPUT_KEYS.test(key))
      .slice(0, 16)
      .map(([key, item]) => [
        cleanString(key, 48),
        Array.isArray(item) ? cleanList(item, 8, 80) : cleanString(item, 160),
      ])
      .filter(([key, item]) => key && (Array.isArray(item) ? item.length : item)),
  );
}

function parseReference(value, fallbackMimeType) {
  const raw = typeof value === 'string' ? value : value?.data;
  const suppliedMimeType = typeof value === 'object'
    ? value?.mimeType || value?.mime_type
    : fallbackMimeType;
  if (!raw || typeof raw !== 'string') {
    throw new RequestError('Each reference must be a valid image.');
  }

  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([\s\S]+)$/i);
  const mimeType = (match?.[1] || suppliedMimeType || '').toLowerCase();
  const data = (match?.[2] || raw).replace(/\s/g, '');
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new RequestError('Upload JPEG, PNG or WebP references only.');
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new RequestError('One reference image is not valid base64 data.');
  }

  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new RequestError('Each reference image must be 5 MB or smaller.');
  }
  return { data: buffer.toString('base64'), mimeType, bytes: buffer.length };
}

function readReferences(body) {
  const inputs = Array.isArray(body.images) && body.images.length
    ? body.images
    : [body.image].filter(Boolean);
  if (!inputs.length || inputs.length > MAX_REFERENCES) {
    throw new RequestError('Add between one and three photos of the same product.');
  }
  return inputs.map((input) => parseReference(input, body.mimeType));
}

function cleanCorrections(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = ['title', 'description', 'category', 'categoryPath', 'occasion', 'targetAudience', 'vibeTags', 'attributes'];
  return Object.fromEntries(
    allowed
      .filter((key) => value[key] !== undefined)
      .map((key) => {
        if (key === 'attributes') return [key, cleanObject(value[key])];
        if (key === 'categoryPath' || key === 'vibeTags') return [key, cleanList(value[key], 8, 80)];
        return [key, cleanString(value[key], key === 'description' ? 700 : 160)];
      }),
  );
}

function asPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10000000) return 0;
  return Math.round(number);
}

function validateProduct(data, corrections) {
  const classification = data?.classification && typeof data.classification === 'object'
    ? data.classification
    : {};
  let categoryPath = [
    classification.department,
    classification.family,
    classification.type,
    classification.subtype,
  ].map((item) => cleanString(item, 80)).filter(Boolean);

  if (!categoryPath.length) {
    categoryPath = cleanList(data?.categoryPath, 4, 80);
  }
  const title = cleanString(data?.title, 120);
  const description = cleanString(data?.description, 700);
  if (!title || !description || !categoryPath.length) {
    throw new Error('The model returned incomplete product understanding.');
  }

  const rawSuggestion = data?.priceSuggestion;
  const suggested = asPrice(
    typeof rawSuggestion === 'object'
      ? rawSuggestion.recommended
      : rawSuggestion ?? data?.price,
  );
  const confidence = Math.min(100, Math.max(0, Math.round(Number(data?.confidence) || 0)));
  const attributes = cleanObject(data?.attributes);
  const product = {
    title,
    description,
    category: categoryPath.at(-1),
    categoryPath,
    attributes,
    occasion: cleanString(data?.occasion, 100),
    targetAudience: cleanString(data?.targetAudience || data?.audience, 120),
    audienceTags: cleanList(data?.audienceTags, 6, 60),
    vibeTags: cleanList(data?.vibeTags, 5, 50),
    confidence,
    price: suggested,
    priceSuggestion: suggested || null,
    priceSuggestionDetails: {
      sellerOnly: true,
      currency: 'INR',
      recommended: suggested || null,
      minimum: asPrice(rawSuggestion?.minimum) || null,
      maximum: asPrice(rawSuggestion?.maximum) || null,
      reason: cleanString(rawSuggestion?.reason, 280),
    },
    insight: cleanString(data?.insight, 360),
    visualBrief: {
      productIdentity: cleanString(data?.visualBrief?.productIdentity, 300),
      styling: cleanString(data?.visualBrief?.styling, 240),
      setting: cleanString(data?.visualBrief?.setting, 240),
      preserve: cleanList(data?.visualBrief?.preserve, 10, 120),
      avoid: cleanList(data?.visualBrief?.avoid, 10, 120),
    },
    uncertainties: cleanList(data?.uncertainties, 10, 160),
    variants: [],
  };

  if (corrections.title) product.title = corrections.title;
  if (corrections.description) product.description = corrections.description;
  if (corrections.categoryPath?.length) {
    product.categoryPath = corrections.categoryPath;
    product.category = corrections.categoryPath.at(-1);
  } else if (corrections.category) {
    product.category = corrections.category;
    product.categoryPath = [corrections.category];
  }
  if (corrections.occasion) product.occasion = corrections.occasion;
  if (corrections.targetAudience) product.targetAudience = corrections.targetAudience;
  if (corrections.vibeTags?.length) product.vibeTags = corrections.vibeTags;
  if (Object.keys(corrections.attributes || {}).length) {
    product.attributes = { ...product.attributes, ...corrections.attributes };
  }

  return product;
}

function isRetryable(error) {
  const status = Number(error?.status || error?.statusCode);
  return !status || status === 408 || status === 429 || status >= 500;
}

async function generateWithOneRetry(model, parts) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await model.generateContent(parts);
    } catch (error) {
      lastError = error;
      if (attempt || !isRetryable(error)) throw error;
    }
  }
  throw lastError;
}

async function idempotent(key, fingerprint, work) {
  pruneCache();
  const existing = cache.get(key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new RequestError('That request key was already used for different images.', 409);
    }
    const result = await existing.promise;
    return {
      ...result,
      meta: { ...result.meta, idempotencyReused: true },
    };
  }

  const promise = work();
  cache.set(key, { fingerprint, promise, createdAt: Date.now() });
  try {
    return await promise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export async function POST(request) {
  const startedAt = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Product generation is temporarily unavailable.' }, { status: 503 });
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      throw new RequestError('The references are too large together. Use up to three compressed product photos.', 413);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      throw new RequestError('Send valid product image data.');
    }
    await authorizeAiRequest(request, body, { units: 1 });
    const references = readReferences(body);
    const corrections = cleanCorrections(body.corrections);
    const hash = createHash('sha256');
    references.forEach((reference) => hash.update(reference.mimeType).update(reference.data));
    hash.update(JSON.stringify(corrections));
    const fingerprint = hash.digest('hex');
    const suppliedKey = cleanString(request.headers.get('idempotency-key') || body.idempotencyKey, 128);
    const requestKey = `merchandise:${suppliedKey || fingerprint}`;

    const payload = await idempotent(requestKey, fingerprint, async () => {
      const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = client.getGenerativeModel({
        model: MODEL,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
      const correctionContext = Object.keys(corrections).length
        ? `\nAUTHORITATIVE SELLER CORRECTIONS:\n${JSON.stringify(corrections)}`
        : '\nNo seller corrections were supplied.';
      const result = await generateWithOneRetry(model, [
        `${prompt}${correctionContext}`,
        ...references.map((reference) => ({
          inlineData: { data: reference.data, mimeType: reference.mimeType },
        })),
      ]);
      const product = validateProduct(parseJson(result.response.text()), corrections);
      return {
        product,
        meta: {
          schemaVersion: SCHEMA_VERSION,
          promptVersion: PROMPT_VERSION,
          model: MODEL,
          latencyMs: Date.now() - startedAt,
          referenceCount: references.length,
          referenceMimeTypes: references.map((reference) => reference.mimeType),
          referenceBytes: references.map((reference) => reference.bytes),
          sellerCorrectionsApplied: Object.keys(corrections).length > 0,
          idempotencyReused: false,
        },
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    const safeError = error instanceof RequestError || error instanceof AiGuardError;
    const status = safeError ? error.status : 502;
    if (!safeError) console.error('Merchandise generation failed:', error);
    return NextResponse.json(
      {
        error: safeError
          ? error.message
          : 'Anya could not confidently read this product. Try clearer reference photos or enter the details manually.',
      },
      { status },
    );
  }
}
