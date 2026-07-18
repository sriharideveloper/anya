const DEFAULT_CATEGORY = 'Boutique edit';
const DEFAULT_OCCASION = 'Everyday elegance';
const DEFAULT_VIBE = 'Curated by Anya AI';

function formatPrice(price) {
  const value = Number(price);
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function normalizePhone(phone) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (!/^\d{10,15}$/.test(cleanPhone)) throw new Error('Invalid WhatsApp number.');
  return cleanPhone;
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
  const cleanPhone = normalizePhone(phone);
  const cleanTitle = String(title || productTitle || '').trim();
  const cleanPrice = Number(price);

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

export function createBundleWhatsAppUrl({ phone, items, storeName, malayalam = false }) {
  const cleanPhone = normalizePhone(phone);
  const cleanItems = (Array.isArray(items) ? items : []).map((item) => ({
    title: String(item?.title || '').trim(),
    price: Number(item?.price),
  }));

  if (cleanItems.length < 2 || cleanItems.some((item) => !item.title || !Number.isFinite(item.price) || item.price < 0)) {
    throw new Error('Invalid bundle details.');
  }

  const itemList = cleanItems.map((item) => `• *${item.title}* — ₹${formatPrice(item.price)}`).join('\n');
  const total = cleanItems.reduce((sum, item) => sum + item.price, 0);
  const cleanStoreName = String(storeName || 'your boutique').trim();
  const message = malayalam
    ? `✨ *Anya AI സ്റ്റൈൽ ബണ്ടിൽ*

നമസ്കാരം ${cleanStoreName}! ഈ രണ്ട് ഇനങ്ങൾ ഒരുമിച്ച് ഓർഡർ ചെയ്യാൻ ആഗ്രഹിക്കുന്നു:

${itemList}

💰 *ആകെ തുക: ₹${formatPrice(total)}*

രണ്ടും ലഭ്യമാണോ? ഡെലിവറി വിശദാംശങ്ങൾ അറിയിക്കാമോ?`
    : `✨ *Anya AI styled bundle*

Hi ${cleanStoreName}! I'd like to order these two pieces together:

${itemList}

💰 *Bundle total: ₹${formatPrice(total)}*

Are both available? Please share the delivery details. Thank you!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

export function createStoreWhatsAppUrl({ phone, storeName, malayalam = false }) {
  const cleanPhone = normalizePhone(phone);
  const cleanStoreName = String(storeName || 'your boutique').trim();
  const message = malayalam
    ? `നമസ്കാരം ${cleanStoreName}! നിങ്ങളുടെ Anya AI ശോപ്പ് കണ്ടു. ശേഖരത്തെക്കുറിച്ച് ഒരു ചോദ്യം ഉണ്ട്.`
    : `Hi ${cleanStoreName}! I found your Anya AI storefront and have a question about the collection.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
