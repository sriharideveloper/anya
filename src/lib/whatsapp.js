export function createWhatsAppUrl({ phone, title, price, mode = 'buy' }) {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanTitle = String(title || '').trim();
  const cleanPrice = Number(price);

  if (!/^\d{10,15}$/.test(cleanPhone)) throw new Error('Invalid WhatsApp number.');
  if (!cleanTitle || !Number.isFinite(cleanPrice)) throw new Error('Invalid product details.');

  const message = mode === 'haggle'
    ? `Hi! I love the *${cleanTitle}* at ₹${cleanPrice.toLocaleString('en-IN')}. Can we agree on a price?`
    : `Hi! I want to order the *${cleanTitle}* for ₹${cleanPrice.toLocaleString('en-IN')}. Is it available?`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
