import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 300;

function findImage(interaction) {
  if (interaction.output_image?.data) return interaction.output_image;

  for (const step of interaction.steps || []) {
    if (step.type !== 'model_output') continue;
    const image = step.content?.find((block) => block.type === 'image' && block.data);
    if (image) return image;
  }

  return null;
}

export async function POST(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 503 });
    }

    const { image, mimeType } = await request.json();
    if (!image || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return NextResponse.json({ error: 'Upload a JPEG, PNG or WebP saree image.' }, { status: 400 });
    }

    const sourceData = image.replace(/^data:image\/(?:jpeg|png|webp);base64,/, '');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const visuals = [];

    for (let index = 0; index < 1; index += 1) {
      const interaction = await ai.interactions.create({
        model: 'gemini-3.1-flash-image',
        input: [
          {
            type: 'text',
            text: 'Create a photorealistic full-length premium fashion editorial of an adult Indian woman wearing the exact saree shown in the reference product image. Preserve the saree\'s fabric color, weave, motifs, border, pallu and visual identity with very high fidelity. Use an elegant natural pose, tasteful matching blouse, refined Indian styling, realistic skin texture, soft luxury studio lighting, and a minimal warm neutral background. The saree must remain the hero product. No text, logos, watermarks, extra garments or distorted hands. Choose a fresh editorial pose and camera angle.',
          },
          {
            type: 'image',
            data: sourceData,
            mime_type: mimeType,
          },
        ],
        response_format: { type: 'image', aspect_ratio: '4:5' },
        generation_config: { thinking_level: 'low' },
      });

      const generated = findImage(interaction);
      if (generated?.data) {
        visuals.push(`data:${generated.mime_type || 'image/png'};base64,${generated.data}`);
      }
    }

    if (!visuals.length) throw new Error('Nano Banana returned no usable image.');
    return NextResponse.json({ visuals });
  } catch (error) {
    console.error('Model visual generation failed:', error);
    return NextResponse.json(
      { error: 'Model visuals could not be generated right now. The original product image is still ready to publish.' },
      { status: 502 },
    );
  }
}
