---
name: anya-whatsapp-engine
description: Generate WhatsApp checkout URLs with pre-filled messages for normal buy and haggle mode in Anya AI.
---

# Anya AI — WhatsApp Engine Skill

## Purpose
Generate perfectly formatted WhatsApp checkout URLs.

## Core Function (`lib/whatsapp.js`)
```javascript
export function generateWhatsAppURL({ phone, productTitle, price, mode = 'buy' }) {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  
  let message;
  
  if (mode === 'haggle') {
    message = `Hi! I love this *${productTitle}* at ₹${price}, but I'm your favorite customer... can we fix a price? 😄`;
  } else {
    message = `Hi! I'm interested in the *${productTitle}*. Is it available for ₹${price}?`;
  }
  
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
}

export function generateBundleWhatsAppURL({ phone, items }) {
  const itemList = items.map(i => `• ${i.title} — ₹${i.price}`).join('\n');
  const total = items.reduce((sum, i) => sum + Number(i.price), 0);
  
  const message = `Hi! I'd like to order this bundle:\n\n${itemList}\n\nTotal: ₹${total}\n\nIs this available?`;
  
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
```

## WhatsApp Button Component
```jsx
'use client';
import { motion } from 'framer-motion';
import { generateWhatsAppURL } from '@/lib/whatsapp';
import styles from './WhatsAppButton.module.scss';

export default function WhatsAppButton({ product, phone, haggleMode }) {
  const handleClick = () => {
    const url = generateWhatsAppURL({
      phone,
      productTitle: product.title,
      price: product.price,
      mode: haggleMode ? 'haggle' : 'buy',
    });
    window.open(url, '_blank');
  };

  return (
    <motion.button
      className={styles.whatsappBtn}
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {haggleMode ? '🤝 Let\'s Haggle!' : '💬 Buy on WhatsApp'}
    </motion.button>
  );
}
```

## Validation Rules
1. Phone number must include country code (e.g., 91 for India)
2. Product title must be non-empty
3. Price must be a positive number
4. URL must use `https://wa.me/` not `whatsapp://`
5. Message text must be properly URI-encoded
6. Test with actual WhatsApp on mobile before demo
