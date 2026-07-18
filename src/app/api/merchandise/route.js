import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

export const runtime = 'nodejs';

const prompt = `You are the merchandiser for a premium Indian boutique. Analyze the product image and return only valid JSON with this exact shape:
{
  "title": "A distinctive premium product name",
  "description": "Two concise, persuasive sentences about the visible product",
  "price": 2500,
  "category": "Saree, Kurti, Lehenga, Blouse, Dupatta, Jewellery, Footwear, Accessories, Men's Wear, Kids' Wear, or Other",
  "vibeTags": ["three", "short", "vibe tags"]
}
The price must be a number in INR between 500 and 50000. Do not use markdown fences.`;

function parseJson(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

function validate(data) {
  const price = Number(data?.price);
  if (!data?.title || !data?.description || !Number.isFinite(price)) {
    throw new Error('Gemini returned incomplete merchandise data.');
  }

  return {
    title: String(data.title).slice(0, 120),
    description: String(data.description).slice(0, 500),
    price: Math.min(50000, Math.max(500, Math.round(price))),
    category: String(data.category || 'Other').slice(0, 50),
    vibeTags: Array.isArray(data.vibeTags)
      ? data.vibeTags.slice(0, 5).map((tag) => String(tag).slice(0, 30))
      : ['Fresh Find', 'Boutique Pick', 'Made to Shine'],
  };
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 503 });
    }

    const { image, mimeType } = await request.json();
    if (!image || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return NextResponse.json({ error: 'Upload a JPEG, PNG or WebP image.' }, { status: 400 });
    }

    const base64 = image.replace(/^data:image\/(?:jpeg|png|webp);base64,/, '');
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: 'gemini-3.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } },
    ]);

    return NextResponse.json({ product: validate(parseJson(result.response.text())) });
  } catch (error) {
    console.error('Merchandise generation failed:', error);
    return NextResponse.json(
      { error: 'Anya could not read that image. Use the editable fallback and publish.' },
      { status: 502 },
    );
  }
}
