'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { createWhatsAppUrl } from '@/lib/whatsapp';
import styles from './ProductCard.module.scss';

export default function ProductCard({ product, phone, index = 0 }) {
  const checkout = (mode) => {
    window.open(createWhatsAppUrl({ phone, title: product.title, price: product.price, mode }), '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.image}>
        <Image src={product.image_url} alt={product.title} fill sizes="(max-width: 560px) 100vw, (max-width: 980px) 50vw, 33vw" />
        {new Date(product.created_at) > new Date(Date.now() - 86400000) && <span>Just dropped</span>}
      </div>
      <div className={styles.content}>
        <small>{product.category || 'Boutique edit'}</small>
        <h2>{product.title}</h2>
        <p>{product.description}</p>
        <div className={styles.tags}>{product.vibe_tags?.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
        <strong>₹{Number(product.price).toLocaleString('en-IN')}</strong>
        <div className={styles.actions}>
          <button onClick={() => checkout('buy')}>Buy on WhatsApp ↗</button>
          <button onClick={() => checkout('haggle')}>Make an offer</button>
        </div>
      </div>
    </motion.article>
  );
}
