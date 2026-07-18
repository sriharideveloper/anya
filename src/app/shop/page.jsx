'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import ProductCard from '@/components/ProductCard/ProductCard';
import { createClient } from '@/lib/supabase/client';
import styles from './Shop.module.scss';

export default function Shop() {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const slug = new URLSearchParams(window.location.search).get('store');
      if (!slug) {
        setError('This storefront link is missing its store name.');
        setLoaded(true);
        return;
      }

      const supabase = createClient();
      const { data: storeData, error: storeError } = await supabase.from('stores').select('*').eq('store_slug', slug).single();
      if (storeError) {
        setError('This storefront could not be found.');
        setLoaded(true);
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from('products_with_badges')
        .select('*')
        .eq('store_id', storeData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setStore(storeData);
      setProducts(productData || []);
      if (productError) setError('Products could not be loaded.');
      setLoaded(true);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => [product.title, product.description, product.category, ...(product.vibe_tags || [])].join(' ').toLowerCase().includes(term));
  }, [products, query]);

  if (!loaded) return <main className={styles.state}>Curating the collection…</main>;
  if (!store) {
    return <main className={styles.state}><span>✦</span><h1>Storefront unavailable.</h1><p>{error}</p><Link href="/dashboard">Open seller studio</Link></main>;
  }

  return (
    <main className={styles.page}>
      <nav>
        <Link href="/" className={styles.brand}>Anya<span>.</span></Link>
        <span>AI-curated · WhatsApp checkout</span>
      </nav>

      <motion.header initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
        <div>
          <span>Welcome to</span>
          <h1>{store.store_name}</h1>
          <p>{store.tagline || 'A collection made to be remembered.'}</p>
        </div>
        <div className={styles.count}><strong>{products.length}</strong><span>curated pieces</span></div>
      </motion.header>

      <section className={styles.toolbar}>
        <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection…" /></label>
        <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
      </section>

      {filtered.length ? (
        <section className={styles.grid}>{filtered.map((product, index) => <ProductCard key={product.id} product={product} phone={store.whatsapp_number} index={index} />)}</section>
      ) : (
        <section className={styles.empty}><span>✦</span><h2>{products.length ? 'Nothing matches that search.' : 'The first drop is coming soon.'}</h2><p>{products.length ? 'Try another word or browse the full collection.' : 'This boutique is preparing its collection.'}</p>{query && <button onClick={() => setQuery('')}>Clear search</button>}</section>
      )}

      <footer><span>{store.store_name}</span><p>Powered by Anya AI · Orders open in WhatsApp</p></footer>
    </main>
  );
}
