'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { createStoreUpdatesWhatsAppUrl, createWhatsAppUrl } from '@/lib/whatsapp';
import styles from './ProductDetail.module.scss';

const ease = [0.22, 1, 0.36, 1];
const blurDataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDYwIDgwIj48ZmlsdGVyIGlkPSJiIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSI4Ii8+PC9maWx0ZXI+PHBhdGggZmlsbD0iI2U5ZGRkMCIgZD0iTTAgMGg2MHY4MEgweiIvPjxwYXRoIGZpbGw9IiNjNGExOGUiIGQ9Ik0tMTAgNjBMMjAgMjBsNTAgNTB2MjBILTEweiIgZmlsdGVyPSJ1cmwoI2IpIiBvcGFjaXR5PSIuNSIvPjwvc3ZnPg==';

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

function cleanOptions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [String(key).trim(), String(item).trim()]).filter(([key, item]) => key && item));
}

export default function ProductDetail({ product, store, shareUrl }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const touchStart = useRef(null);
  const storeHref = store.slug ? `/shop?store=${encodeURIComponent(store.slug)}` : '/shop';
  const vibeLine = [product.occasion, product.vibeTags[0] || product.category, product.region].filter(Boolean);
  const gallery = useMemo(
    () => product.media?.length ? product.media : product.imageUrl ? [{ id: 'legacy-cover', url: product.imageUrl, alt: product.title }] : [],
    [product.imageUrl, product.media, product.title],
  );
  const variants = useMemo(
    () => Array.isArray(product.variants) ? product.variants.filter((variant) => variant.isActive !== false) : [],
    [product.variants],
  );

  const optionGroups = useMemo(() => {
    const groups = new Map();
    variants.forEach((variant) => {
      Object.entries(cleanOptions(variant.options)).forEach(([name, value]) => {
        if (!groups.has(name)) groups.set(name, new Set());
        groups.get(name).add(value);
      });
    });
    return [...groups.entries()].map(([name, values]) => ({ name, values: [...values] }));
  }, [variants]);

  const optionsComplete = optionGroups.every(({ name }) => selectedOptions[name]);
  const selectedVariant = useMemo(() => {
    if (!variants.length || !optionsComplete) return null;
    return variants.find((variant) => {
      const options = cleanOptions(variant.options);
      return optionGroups.every(({ name }) => options[name] === selectedOptions[name]);
    }) || null;
  }, [optionGroups, optionsComplete, selectedOptions, variants]);

  const activePrice = selectedVariant?.price ?? product.price;
  const activeCompareAt = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const activeStock = selectedVariant ? selectedVariant.stockQuantity : product.stockQuantity;
  const stockState = variants.length && optionGroups.length && !optionsComplete
    ? 'choose'
    : activeStock === 0
      ? 'out'
      : activeStock !== null && activeStock > 0 && activeStock <= 5
        ? 'limited'
        : 'available';
  const isSoldOut = stockState === 'out';
  const checkoutBlocked = isSoldOut || (optionGroups.length > 0 && (!optionsComplete || !selectedVariant));
  const discountPercent = activeCompareAt && activeCompareAt > activePrice ? Math.round((1 - activePrice / activeCompareAt) * 100) : null;

  const socialLinks = useMemo(() => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(`Discover ${product.title} from ${store.name}`);
    const media = encodeURIComponent(gallery[activeImage]?.url || product.imageUrl || '');
    return [
      { name: 'WhatsApp', short: 'WA', href: `https://wa.me/?text=${text}%20${url}` },
      { name: 'Facebook', short: 'f', href: `https://www.facebook.com/sharer/sharer.php?u=${url}` },
      { name: 'X', short: 'X', href: `https://twitter.com/intent/tweet?text=${text}&url=${url}` },
      { name: 'Pinterest', short: 'P', href: `https://pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${text}` },
      { name: 'LinkedIn', short: 'in', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}` },
    ];
  }, [activeImage, gallery, product.imageUrl, product.title, shareUrl, store.name]);

  const checkout = (mode) => {
    setActionError('');
    if (checkoutBlocked) {
      setActionError(isSoldOut ? 'This option is currently sold out.' : 'Choose each product option before ordering.');
      return;
    }
    try {
      const url = createWhatsAppUrl({
        phone: store.phone,
        title: product.title,
        price: activePrice,
        category: product.category,
        occasion: product.occasion,
        vibeTags: product.vibeTags,
        selectedOptions,
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

  const moveGallery = (direction) => {
    if (gallery.length < 2) return;
    setActiveImage((current) => (current + direction + gallery.length) % gallery.length);
  };

  const updatesUrl = createStoreUpdatesWhatsAppUrl({ phone: store.phone, storeName: store.name });

  return (
    <motion.main className={styles.page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.55, ease }}>
      <nav className={styles.nav} aria-label="Product navigation">
        <Link href="/" className={styles.brand} aria-label="Anya AI home">Anya<span>.</span></Link>
        <Link href={storeHref} className={styles.storeLink}><span>Back to</span> {store.name} <Icon name="arrow" /></Link>
      </nav>

      <section className={styles.hero}>
        <motion.div className={styles.imagePanel} initial={{ opacity: 0, x: -32 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.75, ease }}>
          <div
            className={styles.imageFrame}
            onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
            onTouchEnd={(event) => {
              if (touchStart.current === null) return;
              const end = event.changedTouches[0]?.clientX ?? touchStart.current;
              if (Math.abs(end - touchStart.current) > 45) moveGallery(end < touchStart.current ? 1 : -1);
              touchStart.current = null;
            }}
          >
            {gallery[activeImage]?.url ? (
              <Image
                key={gallery[activeImage].id || gallery[activeImage].url}
                src={gallery[activeImage].url}
                alt={gallery[activeImage].alt || product.title}
                fill
                priority={activeImage === 0}
                placeholder="blur"
                blurDataURL={blurDataUrl}
                sizes="(max-width: 820px) 100vw, 52vw"
              />
            ) : (
              <div className={styles.imageFallback}><span>✦</span> Boutique image</div>
            )}
            <div className={styles.imageIndex}><span>{gallery[activeImage]?.label || 'ANYA EDIT'}</span><strong>{String(activeImage + 1).padStart(2, '0')}</strong></div>
            {discountPercent > 0 && <span className={styles.discountBadge}>Save {discountPercent}%</span>}
            {gallery.length > 1 && (
              <div className={styles.galleryArrows}>
                <button type="button" onClick={() => moveGallery(-1)} aria-label="Previous product image">‹</button>
                <button type="button" onClick={() => moveGallery(1)} aria-label="Next product image">›</button>
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className={styles.thumbnails} aria-label="Product gallery">
              {gallery.map((item, index) => (
                <button key={item.id || item.url} type="button" onClick={() => setActiveImage(index)} aria-label={`View image ${index + 1}`} aria-pressed={activeImage === index}>
                  <Image src={item.url} alt="" fill sizes="72px" />
                </button>
              ))}
            </div>
          )}
          <p className={styles.imageCaption}>{gallery.length} verified product visual{gallery.length === 1 ? '' : 's'}</p>
        </motion.div>

        <motion.div className={styles.details} initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.08, ease }}>
          <div className={styles.eyebrow}><Icon name="sparkle" /><span>Anya curated · seller verified</span><i /></div>
          <h1>{product.title}</h1>
          <p className={styles.vibeLine}>{vibeLine.map((item) => <span key={item}>{item}</span>)}</p>

          <div className={styles.priceRow}>
            <strong><small>₹</small>{formatPrice(activePrice)}</strong>
            {activeCompareAt > activePrice && <del>₹{formatPrice(activeCompareAt)}</del>}
            {discountPercent > 0 && <span>{discountPercent}% off</span>}
          </div>

          {optionGroups.length > 0 && (
            <div className={styles.variantPicker}>
              {optionGroups.map(({ name, values }) => (
                <fieldset key={name}>
                  <legend>{name}<span>{selectedOptions[name] || 'Choose one'}</span></legend>
                  <div>
                    {values.map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selectedOptions[name] === value}
                        onClick={() => setSelectedOptions((current) => ({ ...current, [name]: value }))}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          <div className={`${styles.stock} ${styles[stockState]}`}>
            <i />
            {stockState === 'choose'
              ? 'Choose your options to check availability'
              : isSoldOut
                ? 'Currently sold out'
                : stockState === 'limited'
                  ? `Only ${activeStock} left — selling quickly`
                  : activeStock !== null
                    ? `${activeStock} pieces available`
                    : 'Available to order'}
          </div>

          <p className={styles.description}>{product.description}</p>

          {Object.keys(product.attributes || {}).length > 0 && (
            <dl className={styles.attributes}>
              {Object.entries(product.attributes).slice(0, 8).map(([name, value]) => (
                <div key={name}><dt>{name.replaceAll('_', ' ')}</dt><dd>{Array.isArray(value) ? value.join(', ') : String(value)}</dd></div>
              ))}
            </dl>
          )}

          <div className={`${styles.actions} ${store.bargainMode ? '' : styles.actionsNoBargain}`}>
            <motion.button className={styles.buy} onClick={() => checkout('buy')} disabled={checkoutBlocked} whileHover={checkoutBlocked ? {} : { y: -2 }} whileTap={checkoutBlocked ? {} : { scale: 0.98 }}>
              <Icon name="bag" /> {isSoldOut ? 'Sold out' : optionGroups.length && !optionsComplete ? 'Choose options' : 'Buy on WhatsApp'} <Icon name="arrow" />
            </motion.button>
            {store.bargainMode && (
              <motion.button className={styles.bargain} onClick={() => checkout('bargain')} disabled={checkoutBlocked} whileHover={checkoutBlocked ? {} : { y: -2 }} whileTap={checkoutBlocked ? {} : { scale: 0.98 }}>
                🤝 Bargain
              </motion.button>
            )}
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

      <section className={styles.buyerNote}>
        <div><span>New drops, no noise</span><h2>Get new arrivals on WhatsApp.</h2><p>This opens a message to the boutique. Anya does not collect your number.</p></div>
        <a href={updatesUrl} target="_blank" rel="noreferrer">Ask for updates <Icon name="arrow" /></a>
      </section>

      <footer className={styles.footer}>
        <div><Link href="/" className={styles.brand}>Anya<span>.</span></Link><p>One photo. One beautiful storefront.</p></div>
        <div><span>Presented by</span><Link href={storeHref}>{store.name}</Link></div>
      </footer>
    </motion.main>
  );
}
