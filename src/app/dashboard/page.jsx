'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './Dashboard.module.scss';

const fallbackProduct = {
  title: 'Midnight Gold Edit',
  description: 'A standout boutique piece with an effortless premium finish. Designed to move from intimate celebrations to unforgettable evenings.',
  price: 2499,
  category: 'Boutique Fashion',
  vibeTags: ['Fresh Find', 'Evening Edit', 'Quiet Luxury'],
};

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error('Could not process the image.'));
      image.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Dashboard() {
  const [image, setImage] = useState('');
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage('Choose a JPEG, PNG or WebP under 5 MB.');
      return;
    }

    try {
      setImage(await compressImage(file));
      setProduct(null);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const generate = async () => {
    if (!image) return setMessage('Choose a product photo first.');
    setStatus('generating');
    setMessage('Anya is styling your product…');

    try {
      const response = await fetch('/api/merchandise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProduct(data.product);
      setMessage('Product ready. Review it and publish.');
    } catch (error) {
      setProduct(fallbackProduct);
      setMessage(`${error.message} Editable fallback loaded.`);
    } finally {
      setStatus('ready');
    }
  };

  const update = (field, value) => setProduct((current) => ({ ...current, [field]: value }));

  const publish = () => {
    if (!product || !image) return;
    const published = {
      ...product,
      price: Number(product.price),
      image,
      publishedAt: new Date().toISOString(),
    };
    localStorage.setItem('anya-product', JSON.stringify(published));
    window.location.assign('/shop');
  };

  return (
    <main className={styles.page}>
      <nav>
        <Link href="/" className={styles.brand}>Anya<span>.</span></Link>
        <Link href="/shop" className={styles.storeLink}>View storefront ↗</Link>
      </nav>

      <header>
        <span>Seller studio</span>
        <h1>One photo.<br /><em>Ready to sell.</em></h1>
        <p>Upload your best product shot. Anya handles the listing.</p>
      </header>

      <section className={styles.workspace}>
        <div className={styles.uploadCard}>
          <label className={`${styles.dropzone} ${image ? styles.hasImage : ''}`}>
            {image ? (
              <Image src={image} alt="Product preview" fill unoptimized sizes="(max-width: 760px) 100vw, 45vw" />
            ) : (
              <div><strong>Drop your product photo</strong><span>JPEG, PNG or WebP · max 5 MB</span></div>
            )}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
          </label>
          <button className={styles.generate} onClick={generate} disabled={!image || status === 'generating'}>
            {status === 'generating' ? <><i /> Generating storefront…</> : 'Generate product with Anya'}
          </button>
          {message && <p className={styles.message}>{message}</p>}
        </div>

        <AnimatePresence mode="wait">
          {product ? (
            <motion.div
              className={styles.editor}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.ready}>Ready to publish</span>
              <label>Product name<input value={product.title} onChange={(event) => update('title', event.target.value)} /></label>
              <label>Description<textarea value={product.description} onChange={(event) => update('description', event.target.value)} /></label>
              <div className={styles.row}>
                <label>Price (₹)<input type="number" min="1" value={product.price} onChange={(event) => update('price', event.target.value)} /></label>
                <label>Category<input value={product.category} onChange={(event) => update('category', event.target.value)} /></label>
              </div>
              <div className={styles.tags}>{product.vibeTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <button className={styles.publish} onClick={publish}>Publish storefront <span>↗</span></button>
            </motion.div>
          ) : (
            <div className={styles.empty}><span>✦</span><p>Your generated product will appear here.</p></div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
