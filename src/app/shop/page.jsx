'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createWhatsAppUrl } from '@/lib/whatsapp';
import styles from './Shop.module.scss';

export default function Shop() {
  const [product, setProduct] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('anya-product');
      if (saved) setProduct(JSON.parse(saved));
    } catch {
      setError('The saved product could not be loaded.');
    } finally {
      setLoaded(true);
    }
  }, []);

  const openWhatsApp = (mode) => {
    try {
      const url = createWhatsAppUrl({
        phone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
        title: product.title,
        price: product.price,
        mode,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (checkoutError) {
      setError(checkoutError.message);
    }
  };

  if (!loaded) return <main className={styles.state}>Opening storefront…</main>;
  if (!product) {
    return (
      <main className={styles.state}>
        <span>✦</span><h1>Your storefront is waiting.</h1>
        <p>{error || 'Generate and publish a product first.'}</p>
        <Link href="/dashboard">Open seller studio</Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <nav><Link href="/" className={styles.brand}>Anya<span>.</span></Link><span>Curated by AI · Sold by you</span></nav>
      <motion.section
        className={styles.product}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.visual}>
          <Image src={product.image} alt={product.title} fill priority unoptimized sizes="(max-width: 800px) 100vw, 52vw" />
          <span className={styles.badge}>Just dropped</span>
        </div>
        <div className={styles.details}>
          <span className={styles.category}>{product.category}</span>
          <h1>{product.title}</h1>
          <div className={styles.tags}>{product.vibeTags?.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <p>{product.description}</p>
          <strong>₹{Number(product.price).toLocaleString('en-IN')}</strong>
          <div className={styles.actions}>
            <button className={styles.buy} onClick={() => openWhatsApp('buy')}>Buy on WhatsApp <span>↗</span></button>
            <button className={styles.haggle} onClick={() => openWhatsApp('haggle')}>Make an offer</button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <small>Direct order · No cart · Chat with the boutique</small>
        </div>
      </motion.section>
    </main>
  );
}
