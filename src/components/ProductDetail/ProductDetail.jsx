'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { createWhatsAppUrl } from '@/lib/whatsapp';
import styles from './ProductDetail.module.scss';

const ease = [0.22, 1, 0.36, 1];
const blurDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDYwIDgwIj48ZmlsdGVyIGlkPSJiIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI4Ii8+PC9maWx0ZXI+PHBhdGggZmlsbD0iI2U5ZGRkMCIgZD0iTTAgMGg2MHY4MEgweiIvPjxwYXRoIGZpbGw9IiNjNGExOGUiIGQ9Ik0tMTAgNjBMMjAgMjBsNTAgNTB2MjBILTEweiIgZmlsdGVyPSJ1cmwoI2IpIiBvcGFjaXR5PSIuNSIvPjwvc3ZnPg==';

function Icon({ name }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    bag: <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    handshake: <><path d="m11 17 2 2a2 2 0 0 0 3-3" /><path d="m14 14 3 3a2 2 0 0 0 3-3l-5-5-3 3a2 2 0 0 1-3-3l4-4a4 4 0 0 1 5 0l3 3" /><path d="m8 9-5 5 4 4 5-5" /><path d="m2 8 4-4 4 4" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4" /><path d="m8.6 13.5 6.8 4" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></>,
    sparkle: <><path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2L12 3Z" /><path d="m5 14-.7 2.3L2 17l2.3.7L5 20l.7-2.3L8 17l-2.3-.7L5 14Z" /></>,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function formatPrice(price) {
  return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function ProductDetail({ product, store, shareUrl }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  const isSoldOut = product.stockState === 'out';
  const storeHref = store.slug ? `/shop?store=${encodeURIComponent(store.slug)}` : '/shop';
  const vibeLine = [product.occasion, product.vibeTags[0] || product.category, product.region].filter(Boolean);

  const socialLinks = useMemo(() => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(`Discover ${product.title} from ${store.name}`);
    const media = encodeURIComponent(product.imageUrl || '');
    return [
      { name: 'WhatsApp', short: 'WA', href: `https://wa.me/?text=${text}%20${url}` },
      { name: 'Instagram', short: 'IG', href: `https://www.instagram.com/?url=${url}` },
      { name: 'Facebook', short: 'f', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
      { name: 'X', short: 'X', href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
      { name: 'Pinterest', short: 'P', href: `https://pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${text}` },
      { name: 'LinkedIn', short: 'in', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    ];
  }, [product.imageUrl, product.title, shareUrl, store.name]);

  const checkout = (mode) => {
    setActionError('');
    try {
      const url = createWhatsAppUrl({
        phone: store.phone,
        title: product.title,
        price: product.price,
        category: product.category,
        occasion: product.occasion,
        vibeTags: product.vibeTags,
        productUrl: shareUrl,
        mode,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setActionError('WhatsApp ordering is not configured for this boutique yet.');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError('Copy this page address from your browser to share it.');
    }
  };

  const nativeShare = async () => {
    if (!navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({ title: product.title, text: `Discover ${product.title} from ${store.name}`, url: window.location.href });
    } catch (error) {
      if (error?.name !== 'AbortError') setActionError('Sharing was interrupted. You can copy the link instead.');
    }
  };

  return (
    <motion.main className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55, ease }}>
      <nav className={styles.nav} aria-label="Product navigation">
        <Link href="/" className={styles.brand} aria-label="Anya AI home">Anya<span>.</span></Link>
        <Link href={storeHref} className={styles.storeLink}>
          <span>Back to</span> {store.name} <Icon name="arrow" />
        </Link>
      </nav>

      <section className={styles.hero}>
        <motion.div className={styles.imagePanel} initial={{ opacity: 0, x: -32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, ease }}>
          <div className={styles.imageFrame}>
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                priority
                placeholder="blur"
                blurDataURL={blurDataUrl}
                sizes="(max-width: 820px) 100vw, 52vw"
              />
            ) : (
              <div className={styles.imageFallback}><span>✦</span> Boutique image</div>
            )}
            <div className={styles.imageIndex}><span>ANYA EDIT</span><strong>01</strong></div>
            {product.discountPercent > 0 && <span className={styles.discountBadge}>Save {product.discountPercent}%</span>}
          </div>
          <p className={styles.imageCaption}>AI-curated for {product.occasion.toLowerCase()} dressing</p>
        </motion.div>

        <motion.div className={styles.details} initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.08, ease }}>
          <div className={styles.eyebrow}><Icon name="sparkle" /><span>{product.aiGenerated ? 'AI Generated' : 'Boutique selection'}</span><i /></div>
          <h1>{product.title}</h1>
          <p className={styles.vibeLine}>{vibeLine.map((item) => <span key={item}>{item}</span>)}</p>

          <div className={styles.priceRow}>
            <strong><small>₹</small>{formatPrice(product.price)}</strong>
            {product.compareAtPrice && <del>₹{formatPrice(product.compareAtPrice)}</del>}
            {product.discountPercent > 0 && <span>{product.discountPercent}% off</span>}
          </div>

          <div className={`${styles.stock} ${styles[product.stockState]}`}>
            <i />
            {isSoldOut
              ? 'Currently sold out'
              : product.stockState === 'limited'
                ? `Only ${product.stockQuantity} left — selling quickly`
                : product.stockQuantity !== null
                  ? `${product.stockQuantity} pieces available`
                  : 'Available to order'}
          </div>

          <p className={styles.description}>{product.description}</p>

          <div className={styles.rating}><span>★★★★★</span> AI Merchandising</div>

          <div className={styles.actions}>
            <motion.button className={styles.buy} onClick={() => checkout('buy')} disabled={isSoldOut} whileHover={isSoldOut ? {} : { y: -2 }} whileTap={isSoldOut ? {} : { scale: 0.98 }}>
              <Icon name="bag" /> {isSoldOut ? 'Sold out' : 'Buy on WhatsApp'} <Icon name="arrow" />
            </motion.button>
            <motion.button className={styles.haggle} onClick={() => checkout('haggle')} disabled={isSoldOut} whileHover={isSoldOut ? {} : { y: -2 }} whileTap={isSoldOut ? {} : { scale: 0.98 }}>
              <Icon name="handshake" /> Haggle
            </motion.button>
            <motion.button className={`${styles.share} ${shareOpen ? styles.shareActive : ''}`} onClick={() => setShareOpen((open) => !open)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} aria-expanded={shareOpen} aria-controls="product-share-panel">
              <Icon name={shareOpen ? 'close' : 'share'} /> Share
            </motion.button>
          </div>

          {actionError && <p className={styles.actionError} role="status">{actionError}</p>}

          <AnimatePresence>
            {shareOpen && (
              <motion.div id="product-share-panel" className={styles.sharePanel} initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -8, height: 0 }} transition={{ duration: 0.35, ease }}>
                <div className={styles.shareHeading}><div><span>Share this piece</span><p>A beautiful find deserves to travel.</p></div><button onClick={nativeShare}><Icon name="share" /> Share anywhere</button></div>
                <div className={styles.socials}>
                  {socialLinks.map((social) => <a key={social.name} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={`Share on ${social.name}`}><b>{social.short}</b><span>{social.name}</span></a>)}
                  <button onClick={copyLink} aria-label="Copy product link"><b><Icon name="copy" /></b><span>{copied ? 'Copied!' : 'Copy link'}</span></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <section className={styles.intelligence}>
        <motion.article className={styles.aiCard} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6, ease }}>
          <div className={styles.aiHeader}>
            <div><Icon name="sparkle" /><span><small>Anya intelligence</small><strong>AI Merchandising</strong></span></div>
            <span className={styles.confidence}>Confidence <b>{product.confidence}%</b></span>
          </div>
          <div className={styles.aiGrid}>
            <div><span>Occasion</span><strong>{product.occasion}</strong></div>
            <div><span>Target audience</span><strong>{product.audience}</strong></div>
            <div><span>Price recommendation</span><strong>{product.priceRecommendation}</strong></div>
            <div><span>Generated in</span><strong>{product.generatedIn}</strong></div>
          </div>
          <div className={styles.confidenceBar}><i style={{ width: `${product.confidence}%` }} /></div>
        </motion.article>

        <motion.aside className={styles.insight} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6, delay: 0.08, ease }}>
          <span>AI insight</span>
          <blockquote>“{product.insight}”</blockquote>
          <div><i /> Curated from colour, category &amp; occasion signals</div>
        </motion.aside>
      </section>

      <footer className={styles.footer}>
        <div><Link href="/" className={styles.brand}>Anya<span>.</span></Link><p>One photo. One beautiful storefront.</p></div>
        <div><span>Presented by</span><Link href={storeHref}>{store.name}</Link></div>
      </footer>
    </motion.main>
  );
}
