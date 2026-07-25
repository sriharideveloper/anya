import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { AiGuardError, authorizeAiRequest } from '@/lib/server/aiGuard';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MODEL = 'gemini-3.1-flash-image';
const PROMPT_VERSION = 'anya-product-visuals-2.0';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_REFERENCES = 3;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = globalThis.__anyaVisualRequests || (globalThis.__anyaVisualRequests = new Map());

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanString(value, max = 300) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

function parseReference(value, fallbackMimeType) {
  const raw = typeof value === 'string' ? value : value?.data;
  const suppliedMimeType = typeof value === 'object'
    ? value?.mimeType || value?.mime_type
    : fallbackMimeType;
  if (!raw || typeof raw !== 'string') throw new RequestError('Each reference must be a valid image.');

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

function cleanProduct(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const visualBrief = value.visualBrief && typeof value.visualBrief === 'object'
    ? value.visualBrief
    : {};
  const attributes = value.attributes && typeof value.attributes === 'object' && !Array.isArray(value.attributes)
    ? Object.fromEntries(
      Object.entries(value.attributes)
        .slice(0, 16)
        .map(([key, item]) => [cleanString(key, 48), cleanString(Array.isArray(item) ? item.join(', ') : item, 140)])
        .filter(([key, item]) => key && item),
    )
    : {};
  return {
    title: cleanString(value.title, 120),
    description: cleanString(value.description, 600),
    category: cleanString(value.category, 100),
    categoryPath: Array.isArray(value.categoryPath)
      ? value.categoryPath.map((item) => cleanString(item, 80)).filter(Boolean).slice(0, 5)
      : [],
    occasion: cleanString(value.occasion, 100),
    attributes,
    visualBrief: {
      productIdentity: cleanString(visualBrief.productIdentity, 300),
      styling: cleanString(visualBrief.styling, 240),
      setting: cleanString(visualBrief.setting, 240),
      preserve: Array.isArray(visualBrief.preserve)
        ? visualBrief.preserve.map((item) => cleanString(item, 120)).filter(Boolean).slice(0, 10)
        : [],
      avoid: Array.isArray(visualBrief.avoid)
        ? visualBrief.avoid.map((item) => cleanString(item, 120)).filter(Boolean).slice(0, 10)
        : [],
    },
  };
}

function findImage(interaction) {
  if (interaction?.output_image?.data) return interaction.output_image;
  for (const step of interaction?.steps || []) {
    if (step.type !== 'model_output') continue;
    const image = step.content?.find((block) => block.type === 'image' && block.data);
    if (image) return image;
  }
  return null;
}

function isRetryable(error) {
  const status = Number(error?.status || error?.statusCode);
  return !status || status === 408 || status === 429 || status >= 500;
}

async function optimizeGeneratedImage(base64) {
  const source = Buffer.from(base64, 'base64');
  if (!source.length) throw new Error('The generated image was empty.');

  const { data, error } = await client(process.env.SUPABASE_SERVICE_ROLE_KEY).storage
    .from('product-images')
    .upload(`${crypto.randomUUID()}.jpg`, source, { contentType: 'image/jpeg' });

  if (error || !data?.path) {
    console.error('Supabase upload failed:', error);
    throw new Error('Could not upload the final image to storage.');
  }

  const { data: publicData } = client(process.env.SUPABASE_SERVICE_ROLE_KEY).storage
    .from('product-images')
    .getPublicUrl(data.path);

  return { publicUrl: publicData.publicUrl, isGenerated: true };
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > CACHE_TTL_MS) cache.delete(key);
  }
}

async function idempotent(key, fingerprint, work) {
  pruneCache();
  const existing = cache.get(key);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      throw new RequestError('That request key was already used for different images.', 409);
    }
    const result = await existing.promise;
    return { ...result, meta: { ...result.meta, idempotencyReused: true } };
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

function buildPrompt(product, index, count) {
  const brief = product.visualBrief || {};
  return `Create premium product photography for reference-accurate ecommerce.
The ${count} requested outputs are deliberate seller-selected variants; create visual ${index + 1} of ${count}.

CONFIRMED PRODUCT ANALYSIS:
${JSON.stringify({
    title: product.title,
    description: product.description,
    classification: product.categoryPath.length ? product.categoryPath : product.category,
    occasion: product.occasion,
    visibleAttributes: product.attributes,
    productIdentity: brief.productIdentity,
    styling: brief.styling,
    setting: brief.setting,
    preserve: brief.preserve,
    avoid: brief.avoid,
  })}

Treat every supplied image as a different view of the SAME physical product.
Preserve its visible colours, shape, proportions, pattern placement, borders, hardware,
surface details, drape, and product identity. Never add logos, text, included components,
extra pieces, sizes, variants, or unseen product features.

Choose presentation from the confirmed product type:
- Adult wearable product: a fully clothed ADULT Indian model, natural neutral pose.
- Jewellery/accessory: adult model or refined product close-up as appropriate.
- Child-specific or non-wearable product: premium still-life or mannequin; never depict a child.

Keep presentation family-safe and non-sexualized. Use realistic anatomy, restrained styling,
warm premium editorial lighting, and a clean Kerala-inspired neutral setting where suitable.
The product is the hero. No text, logos, watermarks, duplicated objects, distorted hands,
or misleading changes. Use a distinct tasteful composition for this output.`;
}

export async function POST(request) {
  const startedAt = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Product visuals are temporarily unavailable.' }, { status: 503 });
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
    await authorizeAiRequest(request, body, { units: 3 });
    const references = readReferences(body);
    const count = body.count === undefined ? 1 : Number(body.count);
    if (count !== 1) {
      throw new RequestError('Generate one visual per request. Seller Studio will safely orchestrate up to five.');
    }
    const variationIndex = Number.isInteger(Number(body.variationIndex))
      ? Math.min(4, Math.max(0, Number(body.variationIndex)))
      : 0;
    const product = cleanProduct(body.product);
    const hash = createHash('sha256');
    references.forEach((reference) => hash.update(reference.mimeType).update(reference.data));
    hash.update(String(count)).update(String(variationIndex)).update(JSON.stringify(product));
    const fingerprint = hash.digest('hex');
    const suppliedKey = cleanString(request.headers.get('idempotency-key') || body.idempotencyKey, 128);
    const requestKey = `visuals:${suppliedKey || fingerprint}`;

    const payload = await idempotent(requestKey, fingerprint, async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const visuals = [];
      const failures = [];
      let retryAvailable = true;

      for (let index = 0; index < count; index += 1) {
        let attempt = 0;
        while (attempt < 2) {
          try {
            const interaction = await ai.interactions.create({
              model: MODEL,
              input: [
                { type: 'text', text: buildPrompt(product, variationIndex, 5) },
                ...references.map((reference) => ({
                  type: 'image',
                  data: reference.data,
                  mime_type: reference.mimeType,
                })),
              ],
              response_format: { type: 'image', aspect_ratio: '4:5' },
            });
            const generated = findImage(interaction);
            if (!generated?.data) throw new Error('No image was returned.');
            visuals.push(await optimizeGeneratedImage(generated.data));
            break;
          } catch (error) {
            const canRetry = attempt === 0 && retryAvailable && isRetryable(error);
            if (canRetry) {
              retryAvailable = false;
              attempt += 1;
              continue;
            }
            console.error(`Product visual ${index + 1} failed:`, error);
            failures.push({ index, message: 'This visual could not be created.' });
            break;
          }
        }
      }

      if (!visuals.length) {
        throw new RequestError(
          'Visuals could not be generated right now. Your original product photos are still ready to publish.',
          502,
        );
      }
      return {
        visuals,
        partial: failures.length > 0,
        failures,
        meta: {
          promptVersion: PROMPT_VERSION,
          model: MODEL,
          latencyMs: Date.now() - startedAt,
          requestedCount: count,
          generatedCount: visuals.length,
          referenceCount: references.length,
          referenceMimeTypes: references.map((reference) => reference.mimeType),
          referenceBytes: references.map((reference) => reference.bytes),
          variationIndex,
          idempotencyReused: false,
        },
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    const safeError = error instanceof RequestError || error instanceof AiGuardError;
    const status = safeError ? error.status : 502;
    if (!safeError) console.error('Model visual generation failed:', error);
    return NextResponse.json(
      {
        error: safeError
          ? error.message
          : 'Visuals could not be generated right now. Your original product photos are still ready to publish.',
      },
      { status },
    );
  }
}
