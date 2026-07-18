'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ProductCard from '@/components/ProductCard/ProductCard';
import { createBundleWhatsAppUrl, createStoreWhatsAppUrl } from '@/lib/whatsapp';
import { createClient } from '@/lib/supabase/client';
import styles from './Shop.module.scss';

const PRICE_VALUE = '(?:₹\\s*|rs\\.?\\s*|inr\\s*)?\\d[\\d,]*(?:\\.\\d+)?\\s*k?';
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'an', 'and', 'around', 'at', 'below', 'between', 'budget',
  'collection', 'cost', 'find', 'for', 'from', 'i', 'in', 'item', 'items', 'less', 'looking',
  'max', 'maximum', 'me', 'min', 'minimum', 'more', 'need', 'of', 'on', 'piece', 'pieces',
  'please', 'price', 'priced', 'range', 'rupee', 'rupees', 'show', 'something', 'than', 'the',
  'to', 'under', 'up', 'want', 'with', 'within',
]);
const COLOR_REFERENCES = [
  { name: 'black', rgb: [24, 22, 22] },
  { name: 'white', rgb: [248, 246, 238] },
  { name: 'grey', rgb: [135, 135, 135] },
  { name: 'red', rgb: [184, 42, 42] },
  { name: 'orange', rgb: [224, 118, 39] },
  { name: 'yellow', rgb: [232, 198, 54] },
  { name: 'green', rgb: [48, 128, 76] },
  { name: 'blue', rgb: [52, 92, 168] },
  { name: 'blue', rgb: [18, 38, 96] },
  { name: 'purple', rgb: [118, 64, 145] },
  { name: 'pink', rgb: [220, 118, 151] },
  { name: 'brown', rgb: [112, 70, 48] },
  { name: 'beige', rgb: [213, 191, 154] },
  { name: 'gold', rgb: [198, 157, 63] },
];
const SEARCH_ALIASES = [
  [/\b(?:saris?|sarees?)\b/gu, 'saree'],
  [/\b(?:kurtas?|kurtis?)\b/gu, 'kurti'],
  [/\b(?:lehengas?)\b/gu, 'lehenga'],
  [/\b(?:jewelry|jewellery|jewels?)\b/gu, 'jewellery'],
  [/\b(?:festivals?|festive)\b/gu, 'festive'],
  [/\b(?:weddings?)\b/gu, 'wedding'],
  [/നീല/gu, 'blue'],
  [/വെള്ള/gu, 'white'],
  [/കറുപ്പ്/gu, 'black'],
  [/ചുവപ്പ്/gu, 'red'],
  [/പച്ച/gu, 'green'],
  [/മഞ്ഞ/gu, 'yellow'],
  [/സ്വർണ്ണ/gu, 'gold'],
  [/സാരി/gu, 'saree'],
  [/കുർത്തി/gu, 'kurti'],
  [/ആഭരണ/gu, 'jewellery'],
  [/ഉത്സവ/gu, 'festive'],
  [/ഓണ(?:ം|ത്തിന്|ക്കാലം)?/gu, 'onam'],
  [/വിവാഹ/gu, 'wedding'],
  [/ദൈനംദിന(?:ം)?/gu, 'everyday'],
  [/താഴെ/gu, 'under'],
  [/കുറഞ്ഞത്/gu, 'at least'],
  [/കൂടുതൽ|മുകളിൽ/gu, 'above'],
  [/മുതൽ/gu, 'from'],
  [/വരെ/gu, 'to'],
];

const COPY = {
  en: {
    navLine: 'AI-curated · WhatsApp checkout',
    welcome: 'Welcome to',
    defaultTagline: 'A collection made to be remembered.',
    pieces: 'curated pieces',
    searchLabel: 'Search this collection',
    searchPlaceholder: 'Try “blue saree under 3000 for Onam”',
    tryThese: 'Smart search ideas',
    results: (count) => `${count} result${count === 1 ? '' : 's'}`,
    activeFilters: 'Understood',
    bundleEyebrow: 'Anya style pairings',
    bundleTitle: 'Complete the look',
    bundleIntro: 'Two boutique pieces, one effortless WhatsApp order.',
    curatedPair: 'Curated pairing',
    defaultPairReason: 'A ready-to-wear pairing selected from this boutique.',
    total: 'Bundle total',
    orderBundle: 'Order both on WhatsApp',
    noMatch: 'Nothing matches that search.',
    firstDrop: 'The first drop is coming soon.',
    noMatchHelp: 'Try a colour, category, occasion, or a different budget.',
    firstDropHelp: 'This boutique is preparing its collection.',
    clearSearch: 'Clear search',
    footer: 'Powered by Anya AI · Orders open in WhatsApp',
    contact: 'Chat with the store',
    productsLabel: 'Boutique collection',
    suggestions: [
      { label: 'Blue saree · under ₹3,000', query: 'blue saree under 3000' },
      { label: 'Onam edit · under ₹5,000', query: 'Onam under 5000' },
      { label: 'Everyday · ₹1,000–₹2,500', query: 'everyday between 1000 and 2500' },
      { label: 'Festive jewellery · under ₹2,000', query: 'festive jewellery under 2000' },
    ],
  },
  ml: {
    navLine: 'AI തിരഞ്ഞെടുത്തത് · WhatsApp ഓർഡർ',
    welcome: 'സ്വാഗതം',
    defaultTagline: 'ഓർമ്മയിൽ നിൽക്കുന്ന ഒരു ശേഖരം.',
    pieces: 'തിരഞ്ഞെടുത്ത ഇനങ്ങൾ',
    searchLabel: 'ഈ ശേഖരത്തിൽ തിരയൂ',
    searchPlaceholder: '“ഓണത്തിന് നീല സാരി ₹3000-ൽ താഴെ”',
    tryThese: 'സ്മാർട്ട് തിരയൽ ആശയങ്ങൾ',
    results: (count) => `${count} ഫലങ്ങൾ`,
    activeFilters: 'മനസ്സിലായത്',
    bundleEyebrow: 'Anya AI സ്റ്റൈൽ',
    bundleTitle: 'ലുക്ക് പൂർത്തിയാക്കൂ',
    bundleIntro: 'രണ്ട് ബുട്ടീക്ക് ഇനങ്ങൾ, ഒരു എളുപ്പ WhatsApp ഓർഡർ.',
    curatedPair: 'തിരഞ്ഞെടുത്ത ജോഡി',
    defaultPairReason: 'ഈ ബുട്ടീക്കിൽ നിന്ന് തിരഞ്ഞെടുത്ത റെഡി-ടു-വെയർ ജോഡി.',
    total: 'ആകെ തുക',
    orderBundle: 'WhatsApp-ൽ രണ്ടും ഓർഡർ ചെയ്യൂ',
    noMatch: 'ഈ തിരയലിന് ചേരുന്നത് ഒന്നും കണ്ടെത്തിയില്ല.',
    firstDrop: 'ആദ്യ ശേഖരം ഉടൻ വരുന്നു.',
    noMatchHelp: 'മറ്റൊരു നിറം, വിഭാഗം, അവസരം, അല്ലെങ്കിൽ ബജറ്റ് പരിധി പരീക്ഷിക്കൂ.',
    firstDropHelp: 'ഈ ബുട്ടീക്ക് ശേഖരം ഒരുക്കുകയാണ്.',
    clearSearch: 'തിരയൽ മായ്ക്കൂ',
    footer: 'Anya AI നൽകുന്നു · WhatsApp-ൽ ഓർഡർ ചെയ്യൂ',
    contact: 'കടയുമായി സംസാരിക്കൂ',
    productsLabel: 'ബുട്ടീക്ക് ശേഖരം',
    termLabels: {
      beige: 'ബീഷ്', black: 'കറുപ്പ്', blue: 'നീല', brown: 'ബ്രൗൺ', everyday: 'ദൈനംദിനം',
      festive: 'ഉത്സവം', gold: 'സ്വർണ്ണം', green: 'പച്ച', grey: 'ചാരനിറം', jewellery: 'ആഭരണം',
      kurti: 'കുർത്തി', onam: 'ഓണം', orange: 'ഓറഞ്ച്', pink: 'പിങ്ക്', purple: 'പർപ്പിൾ', red: 'ചുവപ്പ്',
      saree: 'സാരി', wedding: 'വിവാഹം', white: 'വെള്ള', yellow: 'മഞ്ഞ',
    },
    suggestions: [
      { label: 'നീല സാരി · ₹3,000-ൽ താഴെ', query: 'നീല സാരി ₹3,000-ൽ താഴെ' },
      { label: 'ഓണം · ₹5,000-ൽ താഴെ', query: 'ഓണം ₹5,000-ൽ താഴെ' },
      { label: 'ദൈനംദിനം · ₹1,000–₹2,500', query: 'ദൈനംദിനം 1000 മുതൽ 2500 വരെ' },
      { label: 'ഉത്സവ ആഭരണം · ₹2,000-ൽ താഴെ', query: 'ഉത്സവ ആഭരണം ₹2,000-ൽ താഴെ' },
    ],
  },
};

function normalizeSearchText(value) {
  let normalized = String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-IN')
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019']/g, '');

  SEARCH_ALIASES.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized;
}

function parsePrice(value) {
  const normalized = String(value || '').toLowerCase().replace(/,/g, '');
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!match) return null;
  const price = Number(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(price) ? price : null;
}

function parseSearchQuery(query) {
  let searchable = normalizeSearchText(query);
  let minPrice = null;
  let maxPrice = null;

  const captureRange = (pattern) => {
    searchable = searchable.replace(pattern, (match, first, second) => {
      const firstPrice = parsePrice(first);
      const secondPrice = parsePrice(second);
      if (firstPrice !== null && secondPrice !== null) {
        const low = Math.min(firstPrice, secondPrice);
        const high = Math.max(firstPrice, secondPrice);
        minPrice = minPrice === null ? low : Math.max(minPrice, low);
        maxPrice = maxPrice === null ? high : Math.min(maxPrice, high);
      }
      return ' ';
    });
  };

  captureRange(new RegExp(`\\b(?:between|from)\\s+(${PRICE_VALUE})\\s+(?:and|to)\\s+(${PRICE_VALUE})`, 'giu'));
  captureRange(new RegExp(`(${PRICE_VALUE})\\s+from\\s+(${PRICE_VALUE})\\s+to\\b`, 'giu'));
  captureRange(new RegExp(`(${PRICE_VALUE})\\s*(?:–|—|-)\\s*(${PRICE_VALUE})`, 'giu'));

  const captureBound = (pattern, bound) => {
    searchable = searchable.replace(pattern, (match, rawPrice) => {
      const price = parsePrice(rawPrice);
      if (price !== null) {
        if (bound === 'max') maxPrice = maxPrice === null ? price : Math.min(maxPrice, price);
        if (bound === 'min') minPrice = minPrice === null ? price : Math.max(minPrice, price);
      }
      return ' ';
    });
  };

  captureBound(new RegExp(`\\b(?:under|below|less\\s+than|up\\s*to|upto|max(?:imum)?(?:\\s+of)?|within)\\s*(${PRICE_VALUE})`, 'giu'), 'max');
  captureBound(new RegExp(`(${PRICE_VALUE})(?:\\s*-\\s*ൽ)?\\s*(?:or\\s+less|and\\s+below|under|below)\\b`, 'giu'), 'max');
  captureBound(new RegExp(`\\b(?:over|above|more\\s+than|at\\s+least|min(?:imum)?(?:\\s+of)?)\\s*(${PRICE_VALUE})`, 'giu'), 'min');
  captureBound(new RegExp(`(${PRICE_VALUE})(?:\\s*-\\s*ൽ)?\\s*(?:or\\s+more|and\\s+above|over|above)\\b`, 'giu'), 'min');
  captureBound(new RegExp(`(${PRICE_VALUE})\\s*\\+`, 'giu'), 'min');

  const terms = [...new Set(
    searchable
      .replace(/(?:₹|\brs\.?\b|\binr\b)/gu, ' ')
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((term) => term.length > 1 && !STOP_WORDS.has(term)) || [],
  )];

  return {
    minPrice,
    maxPrice,
    terms,
    hasFilters: terms.length > 0 || minPrice !== null || maxPrice !== null,
  };
}

function paletteColorWords(colorPalette) {
  if (!colorPalette || typeof colorPalette !== 'object') return [];

  return Object.values(colorPalette).flatMap((value) => {
    const color = String(value || '').trim();
    const hexMatch = color.match(/^#([a-f\d]{6})$/i);
    if (!hexMatch) return normalizeSearchText(color).match(/[\p{L}\p{N}]+/gu) || [];

    const rgb = [0, 2, 4].map((offset) => Number.parseInt(hexMatch[1].slice(offset, offset + 2), 16));
    const nearest = COLOR_REFERENCES.reduce((best, reference) => {
      const distance = reference.rgb.reduce((sum, channel, index) => sum + ((channel - rgb[index]) ** 2), 0);
      return distance < best.distance ? { name: reference.name, distance } : best;
    }, { name: '', distance: Number.POSITIVE_INFINITY });

    return nearest.name ? [nearest.name] : [];
  });
}

function productSearchWords(product) {
  const searchable = normalizeSearchText([
    product.title,
    product.description,
    product.category,
    product.occasion,
    ...(product.vibe_tags || []),
    JSON.stringify(product.color_palette || {}),
    ...paletteColorWords(product.color_palette),
  ].filter(Boolean).join(' '));

  return new Set(searchable.match(/[\p{L}\p{N}]+/gu) || []);
}

function filterProducts(products, query) {
  if (!query.trim()) return { items: products, filters: parseSearchQuery('') };

  const filters = parseSearchQuery(query);
  const items = products.filter((product) => {
    const price = product.price === null || product.price === undefined || product.price === '' ? Number.NaN : Number(product.price);
    if (filters.minPrice !== null && (!Number.isFinite(price) || price < filters.minPrice)) return false;
    if (filters.maxPrice !== null && (!Number.isFinite(price) || price > filters.maxPrice)) return false;

    const words = productSearchWords(product);
    return filters.terms.every((term) => words.has(term));
  });

  return { items, filters };
}

function productIsAvailable(product) {
  const stockValue = product.stock_quantity ?? product.quantity ?? product.stock;
  return stockValue === null || stockValue === undefined || stockValue === '' || Number(stockValue) > 0;
}

function hydrateBundles(bundleRows, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const seenPairs = new Set();

  return bundleRows.flatMap((bundle) => {
    const first = productMap.get(bundle.product_id);
    const second = productMap.get(bundle.recommended_product_id);
    const pairKey = [bundle.product_id, bundle.recommended_product_id].sort().join(':');

    if (!first || !second || seenPairs.has(pairKey) || !productIsAvailable(first) || !productIsAvailable(second)) return [];
    if (![first, second].every((product) => product.price !== null && product.price !== undefined && product.price !== '' && Number.isFinite(Number(product.price)))) return [];

    seenPairs.add(pairKey);
    return [{ ...bundle, products: [first, second], total: Number(first.price) + Number(second.price) }];
  });
}

function formatPrice(price) {
  return Number(price).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function Shop() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [bundleRows, setBundleRows] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const slug = new URLSearchParams(window.location.search).get('store');
      if (!slug) {
        if (!cancelled) {
          setError('This storefront link is missing its store name.');
          setLoaded(true);
        }
        return;
      }

      const supabase = createClient();
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('*')
        .eq('store_slug', slug)
        .single();

      if (storeError || !storeData) {
        if (!cancelled) {
          setError('This storefront could not be found.');
          setLoaded(true);
        }
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const nextProducts = productData || [];
      let nextBundles = [];

      if (!productError && nextProducts.length > 1) {
        const { data } = await supabase
          .from('bundles')
          .select('id, product_id, recommended_product_id, recommendation_reason, created_at')
          .in('product_id', nextProducts.map((product) => product.id))
          .order('created_at', { ascending: false });
        nextBundles = data || [];
      }

      if (!cancelled) {
        setStore(storeData);
        setProducts(nextProducts);
        setBundleRows(nextBundles);
        if (productError) setError('Products could not be loaded.');
        setLoaded(true);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const searchResult = useMemo(() => filterProducts(products, debouncedQuery), [products, debouncedQuery]);
  const bundles = useMemo(() => hydrateBundles(bundleRows, products), [bundleRows, products]);
  const visibleBundles = useMemo(() => {
    if (!debouncedQuery.trim()) return bundles.slice(0, 4);
    const matchingIds = new Set(searchResult.items.map((product) => product.id));
    return bundles.filter((bundle) => bundle.products.some((product) => matchingIds.has(product.id))).slice(0, 4);
  }, [bundles, debouncedQuery, searchResult.items]);

  const language = store?.malayalam_mode ? 'ml' : 'en';
  const copy = COPY[language];

  const orderBundle = (bundle) => {
    window.open(createBundleWhatsAppUrl({
      phone: store.whatsapp_number,
      storeName: store.store_name,
      items: bundle.products,
      malayalam: language === 'ml',
    }), '_blank', 'noopener,noreferrer');
  };

  if (!loaded) return <main className={styles.state}>Curating the collection…</main>;
  if (!store) {
    return <main className={styles.state}><span>✦</span><h1>Storefront unavailable.</h1><p>{error}</p><Link href="/dashboard">Open seller studio</Link></main>;
  }

  const contactUrl = createStoreWhatsAppUrl({
    phone: store.whatsapp_number,
    storeName: store.store_name,
    malayalam: language === 'ml',
  });

  return (
    <main className={`${styles.page} ${language === 'ml' ? styles.malayalam : ''}`} lang={language}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>Anya<span>.</span></Link>
        <span>{copy.navLine}</span>
      </nav>

      <motion.header initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
        <div>
          <span>{copy.welcome}</span>
          <h1>{store.store_name}</h1>
          <p>{store.tagline || copy.defaultTagline}</p>
        </div>
        <div className={styles.count}><strong>{products.length}</strong><span>{copy.pieces}</span></div>
      </motion.header>

      <section className={styles.discovery} aria-label={copy.searchLabel}>
        <div className={styles.toolbar}>
          <label>
            <span aria-hidden="true">⌕</span>
            <span className={styles.srOnly}>{copy.searchLabel}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} type="search" autoComplete="off" />
          </label>
          {query && <button type="button" className={styles.clearInput} onClick={() => setQuery('')} aria-label={copy.clearSearch}>×</button>}
          <span className={styles.resultCount} aria-live="polite">{copy.results(searchResult.items.length)}</span>
        </div>

        <div className={styles.suggestions}>
          <span>{copy.tryThese}</span>
          <div>
            {copy.suggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion.label}
                onClick={() => setQuery(suggestion.query)}
                aria-pressed={query === suggestion.query}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>

        {searchResult.filters.hasFilters && (
          <div className={styles.filterReadout} aria-live="polite">
            <strong>{copy.activeFilters}</strong>
            {searchResult.filters.terms.map((term) => <span key={term}>{copy.termLabels?.[term] || term}</span>)}
            {searchResult.filters.minPrice !== null && <span>₹{formatPrice(searchResult.filters.minPrice)}+</span>}
            {searchResult.filters.maxPrice !== null && <span>≤ ₹{formatPrice(searchResult.filters.maxPrice)}</span>}
          </div>
        )}
      </section>

      {visibleBundles.length > 0 && (
        <section className={styles.bundleSection} aria-labelledby="bundle-heading">
          <motion.div className={styles.sectionHeading} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
            <div><span>{copy.bundleEyebrow}</span><h2 id="bundle-heading">{copy.bundleTitle}</h2></div>
            <p>{copy.bundleIntro}</p>
          </motion.div>

          <div className={styles.bundleGrid}>
            {visibleBundles.map((bundle, index) => (
              <motion.article
                className={styles.bundleCard}
                key={bundle.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className={styles.bundleVisual}>
                  {bundle.products.map((product) => (
                    <Link href={`/product/${encodeURIComponent(product.id)}`} className={styles.bundleImage} key={product.id} aria-label={`View ${product.title}`}>
                      <Image src={product.image_url} alt={product.title} fill sizes="(max-width: 560px) 45vw, (max-width: 1040px) 25vw, 16vw" />
                    </Link>
                  ))}
                  <span className={styles.bundleJoin} aria-hidden="true">+</span>
                </div>

                <div className={styles.bundleContent}>
                  <span>{copy.curatedPair}</span>
                  <div className={styles.bundleNames}>
                    {bundle.products.map((product) => <Link href={`/product/${encodeURIComponent(product.id)}`} key={product.id}>{product.title}</Link>)}
                  </div>
                  <p>{language === 'ml' ? copy.defaultPairReason : bundle.recommendation_reason || copy.defaultPairReason}</p>
                  <div className={styles.bundleTotal}><span>{copy.total}</span><strong>₹{formatPrice(bundle.total)}</strong></div>
                  <button type="button" onClick={() => orderBundle(bundle)}>{copy.orderBundle}<span aria-hidden="true">↗</span></button>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      )}

      {searchResult.items.length ? (
        <section className={styles.grid} aria-label={copy.productsLabel}>
          {searchResult.items.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              phone={store.whatsapp_number}
              haggleMode={Boolean(store.haggle_mode)}
              index={index}
            />
          ))}
        </section>
      ) : (
        <section className={styles.empty}>
          <span>✦</span>
          <h2>{products.length ? copy.noMatch : copy.firstDrop}</h2>
          <p>{products.length ? copy.noMatchHelp : copy.firstDropHelp}</p>
          {query && <button type="button" onClick={() => setQuery('')}>{copy.clearSearch}</button>}
        </section>
      )}

      <footer><span>{store.store_name}</span><p>{copy.footer}</p></footer>

      <a className={styles.floatingContact} href={contactUrl} target="_blank" rel="noreferrer" aria-label={`${copy.contact}: ${store.store_name}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.84 9.84 0 0 0-8.43 14.92L2.1 22l5.2-1.36A9.93 9.93 0 1 0 12 2Zm0 17.86a7.88 7.88 0 0 1-4.02-1.1l-.29-.17-3.09.81.82-3-.19-.31A7.82 7.82 0 1 1 12 19.86Zm4.3-5.87c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.61.77-.75.93-.14.16-.28.18-.52.06-1.4-.7-2.32-1.25-3.25-2.83-.25-.43.25-.4.7-1.33.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62 1.52.66 2.12.71 2.88.6.46-.07 1.4-.57 1.6-1.13.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" /></svg>
        <span>{copy.contact}</span>
      </a>
    </main>
  );
}
