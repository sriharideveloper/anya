const DEFAULT_CATEGORY = 'Boutique edit';
const DEFAULT_OCCASION = 'Everyday elegance';
const DEFAULT_VIBE = 'Curated by Anya AI';

function formatPrice(price) {
  const value = Number(price);
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function normalizeVibeTags(vibeTags) {
  const tags = Array.isArray(vibeTags)
    ? vibeTags
    : String(vibeTags || '')
        .split(',')
        .map((tag) => tag.trim());

  return tags.filter(Boolean).join(' • ') || DEFAULT_VIBE;
}

export function createWhatsAppUrl({
  phone,
  title,
  productTitle,
  price,
  category,
  occasion,
  vibeTags,
  vibe_tags: legacyVibeTags,
  mode = 'buy',
}) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanTitle = String(title || productTitle || '').trim();
  const cleanPrice = Number(price);

  if (!/^\d{10,15}$/.test(cleanPhone)) throw new Error('Invalid WhatsApp number.');
  if (!cleanTitle || !Number.isFinite(cleanPrice)) throw new Error('Invalid product details.');

  const formattedPrice = formatPrice(cleanPrice);
  const message = mode === 'haggle'
    ? `🤝 *Hi!*

I absolutely loved your

✨ *${cleanTitle}*

Priced at *₹${formattedPrice}*.

I was wondering if there's any festive offer or best price available 😊

Looking forward to hearing from you!`
    : `🛍️ *I'm interested in this product!*

━━━━━━━━━━━━━━

✨ *${cleanTitle}*

💰 Price: *₹${formattedPrice}*

🏷️ Category: ${String(category || DEFAULT_CATEGORY).trim()}

🌸 Occasion: ${String(occasion || DEFAULT_OCCASION).trim()}

🎨 Vibe:
${normalizeVibeTags(vibeTags ?? legacyVibeTags)}

━━━━━━━━━━━━━━

Hi! I found this through your Anya AI storefront.

Is it still available?

I'd love to know:
• Available colours
• Sizes
• Delivery options

Thank you! 😊`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
