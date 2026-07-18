---
name: anya-gemini-pipeline
description: Integrate Google Gemini AI for product merchandising, smart search, reference outfit matching, bundle generation, and vibe tag creation in Anya AI.
---

# Anya AI — Gemini AI Pipeline Skill

## Purpose
Handle all Gemini AI integrations for Anya AI's intelligent features.

## Setup
```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
```

## Feature 1: Product Merchandising (Core)

### API Route: `/api/merchandise`
Accepts an uploaded image, sends to Gemini Vision, returns structured product data.

### Gemini Prompt
```
You are an elite fashion merchandiser for a premium Kerala boutique.

Analyze this product image and return ONLY valid JSON (no markdown, no code fences):

{
  "title": "A creative, luxury product name (not generic). Examples: 'Rose Blossom Kanjivaram', 'Sunset Elegance Silk', 'Temple Gold Heritage'",
  "description": "A compelling 2-3 sentence product description highlighting fabric, craftsmanship, and styling versatility. Write in an aspirational luxury tone.",
  "price_guess": "Estimated retail price as a number (INR). Consider fabric quality, craftsmanship visible in the image. Range: 500-50000",
  "category": "One of: Saree, Kurti, Lehenga, Blouse, Dupatta, Jewellery, Footwear, Accessories, Men's Wear, Kids' Wear, Other",
  "occasion": "One of: Casual, Office, Wedding, Temple, Onam, Party, Festival, Everyday, Date Night",
  "vibe_tags": ["Array of 3-5 contextual vibe tags. NOT generic material tags. Examples: 'Kalyanam Ready', 'Onam Special', 'Temple Collection', 'Minimal Luxury', 'Everyday Elegance', 'Boss Lady', 'Weekend Brunch', 'Festive Glow'"],
  "color_palette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex"
  }
}
```

### Response Validation
```javascript
function validateMerchandiseResponse(data) {
  const required = ['title', 'description', 'price_guess', 'category', 'vibe_tags'];
  for (const field of required) {
    if (!data[field]) throw new Error(`Missing required field: ${field}`);
  }
  if (!Array.isArray(data.vibe_tags) || data.vibe_tags.length === 0) {
    throw new Error('vibe_tags must be a non-empty array');
  }
  const price = Number(data.price_guess);
  if (isNaN(price) || price <= 0) throw new Error('Invalid price_guess');
  return { ...data, price_guess: price };
}
```

### Error Handling
- If Gemini returns markdown-wrapped JSON, strip the fences before parsing
- Retry up to 2 times on parse failure with a more strict prompt
- If image is not a fashion product, return a friendly error

## Feature 2: AI Smart Search

### API Route: `/api/search`

### Gemini Prompt
```
You are a shopping assistant for a Kerala boutique.

The customer said: "${userQuery}"

Extract search filters and return ONLY valid JSON:

{
  "category": "string or null",
  "occasion": "string or null",
  "max_price": "number or null",
  "min_price": "number or null",
  "color": "string or null",
  "vibe": "string or null",
  "keywords": ["array of search keywords"]
}
```

## Feature 3: Reference Outfit Search

### API Route: `/api/reference-search`

Customer uploads a reference image (from Pinterest, Instagram, etc.)

Gemini analyzes the reference and compares against catalog.

### Gemini Prompt
```
You are a fashion matching expert.

Analyze this reference outfit image and describe it in detail.
Return ONLY valid JSON:

{
  "description": "Detailed description of the outfit",
  "category": "Primary category",
  "style_keywords": ["array of style descriptors"],
  "color_family": "primary color family",
  "occasion": "likely occasion",
  "price_range": "budget/mid/premium"
}
```

Then match against product catalog using embeddings or keyword matching.

## Feature 4: AI Bundle Generator

### Gemini Prompt
```
You are a fashion stylist.

The customer is viewing: ${productTitle} (${productCategory})
Description: ${productDescription}

Suggest 3 complementary items that would complete this look.
Return ONLY valid JSON:

{
  "suggestions": [
    {
      "category": "e.g., Blouse, Jewellery, Footwear",
      "description": "Brief description of the recommended item",
      "style_note": "Why this pairs well"
    }
  ]
}
```

## Feature 5: Malayalam Localization

### Gemini Prompt
```
Translate the following product information to Malayalam (മലയാളം).
Keep brand names and proper nouns in English.
Return ONLY valid JSON with same keys:

${JSON.stringify(productData)}
```

## Safety Rules
1. ALWAYS validate JSON responses before using
2. ALWAYS strip markdown code fences from Gemini responses
3. NEVER expose the API key client-side
4. ALWAYS use try-catch with meaningful error messages
5. Rate limit API calls — max 10 per minute per user
6. Sanitize all user inputs before sending to Gemini
7. Set appropriate `safetySettings` on the model
