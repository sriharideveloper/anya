'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createWhatsAppUrl } from '@/lib/whatsapp';
import styles from './ProductCard.module.scss';

async function copyShareUrl(url) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy was unavailable.');
}

export default function ProductCard({ product, phone, haggleMode = false, index = 0 }) {
  const [shareState, setShareState] = useState('idle');
  const productHref = `/product/${encodeURIComponent(product.id)}`;
  const price = Number(product.price);
  const compareAtCandidate = product.compare_at_price ?? product.original_price ?? product.mrp;
  const compareAtPrice = Number(compareAtCandidate);
  const hasDiscount = Number.isFinite(compareAtPrice) && compareAtPrice > price;
  const discountPercent = hasDiscount ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
  const stockCandidate = product.stock_quantity ?? product.quantity ?? product.stock;
  const hasStockCount = stockCandidate !== null && stockCandidate !== undefined && stockCandidate !== '' && Number.isFinite(Number(stockCandidate));
  const stock = hasStockCount ? Math.max(0, Math.floor(Number(stockCandidate))) : null;
  const isSoldOut = stock === 0;
  const isLimited = stock !== null && stock > 0 && stock <= 3;
  const isNew = product.is_just_dropped || (product.created_at && new Date(product.created_at) > new Date(Date.now() - 86400000));

  const checkout = (mode) => {
    if (isSoldOut) return;

    window.open(createWhatsAppUrl({
      phone,
      title: product.title,
      price,
      category: product.category,
      occasion: product.occasion,
      vibeTags: product.vibe_tags,
      mode,
    }), '_blank', 'noopener,noreferrer');
  };

  const shareProduct = async () => {
    const url = new URL(productHref, window.location.origin).toString();
    const shareData = {
      title: product.title,
      text: `Discover ${product.title} at ${product.store_name || 'this Anya AI boutique'}.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await copyShareUrl(url);
      setShareState('copied');
    } catch (error) {
      if (error?.name === 'AbortError') return;

      try {
        await copyShareUrl(url);
        setShareState('copied');
      } catch {
        setShareState('failed');
      }
    }

    window.setTimeout(() => setShareState('idle'), 2200);
  };

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={productHref} className={styles.image} aria-label={`View ${product.title}`}>
        <Image
          src={product.image_url}
          alt={product.title}
          fill
          sizes="(max-width: 560px) 100vw, (max-width: 980px) 50vw, 33vw"
        />
        <span className={styles.badges}>
          {hasDiscount && <span className={styles.discountBadge}>{discountPercent}% off</span>}
          {(product.is_trending || Number(product.view_count) > 50 || isNew) && (
            <span className={styles.dropBadge}>{product.is_trending || Number(product.view_count) > 50 ? 'Trending now' : 'Just dropped'}</span>
          )}
        </span>
        {(isSoldOut || isLimited) && (
          <span className={`${styles.stockBadge} ${isSoldOut ? styles.soldOutBadge : styles.limitedBadge}`}>
            {isSoldOut ? 'Sold out' : `Only ${stock} left`}
          </span>
        )}
        <span className={styles.viewCue}>View piece <span aria-hidden="true">↗</span></span>
      </Link>

      <div className={styles.content}>
        <div className={styles.eyebrow}>
          <small>{product.category || 'Boutique edit'}</small>
          <span className={`${styles.availability} ${isSoldOut ? styles.soldOut : isLimited ? styles.limited : styles.inStock}`}>
            {isSoldOut ? 'Sold out' : isLimited ? `Limited · ${stock} left` : 'In stock'}
          </span>
        </div>
        <h2><Link href={productHref}>{product.title}</Link></h2>
        <p>{product.description}</p>
        <div className={styles.tags}>
          {product.vibe_tags?.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <div className={styles.priceRow}>
          <strong>₹{price.toLocaleString('en-IN')}</strong>
          {hasDiscount && <del>₹{compareAtPrice.toLocaleString('en-IN')}</del>}
          {hasDiscount && <span>You save ₹{(compareAtPrice - price).toLocaleString('en-IN')}</span>}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => checkout('buy')} disabled={isSoldOut}>
            {isSoldOut ? 'Sold out' : '❤️ Buy on WhatsApp'}
          </button>
          <button type="button" onClick={() => checkout('haggle')} disabled={isSoldOut} hidden={!haggleMode}>🤝 Haggle</button>
          <button type="button" onClick={shareProduct} aria-live="polite">
            {shareState === 'copied' ? '✓ Link copied' : shareState === 'failed' ? 'Copy failed' : '📤 Share'}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
