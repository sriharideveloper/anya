'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import AuthPanel from '@/components/AuthPanel/AuthPanel';
import { createClient } from '@/lib/supabase/client';
import styles from './Dashboard.module.scss';

const fallbackProduct = {
  title: 'Midnight Gold Edit',
  description: 'A standout boutique piece with an effortless premium finish. Designed to move from intimate celebrations to unforgettable evenings.',
  price: 2499,
  category: 'Saree',
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

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeForm, setStoreForm] = useState({ name: '', whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '' });
  const [image, setImage] = useState('');
  const [product, setProduct] = useState(null);
  const [visuals, setVisuals] = useState([]);
  const [selectedVisual, setSelectedVisual] = useState('');
  const [visualCount, setVisualCount] = useState(1);
  const [visualStatus, setVisualStatus] = useState('idle');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const visualGeneration = useRef(0);

  const loadProducts = useCallback(async (storeId) => {
    const supabase = createClient();
    const { data } = await supabase.from('products').select('*').eq('store_id', storeId).order('created_at', { ascending: false });
    setProducts(data || []);
  }, []);

  const loadSeller = useCallback(async (activeSession) => {
    if (!activeSession?.user) {
      setSession(null);
      setStore(null);
      setLoading(false);
      return;
    }

    setSession(activeSession);
    const supabase = createClient();
    const { data } = await supabase.from('stores').select('*').eq('owner_id', activeSession.user.id).maybeSingle();
    setStore(data || null);
    if (data) await loadProducts(data.id);
    setLoading(false);
  }, [loadProducts]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => loadSeller(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      setTimeout(() => loadSeller(activeSession), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadSeller]);

  const createStore = async (event) => {
    event.preventDefault();
    const cleanWhatsapp = storeForm.whatsapp.replace(/\D/g, '');
    if (!storeForm.name.trim() || !/^\d{10,15}$/.test(cleanWhatsapp)) {
      setMessage('Add a store name and WhatsApp number with country code.');
      return;
    }

    setStatus('saving');
    const supabase = createClient();
    const baseSlug = slugify(storeForm.name) || 'anya-store';
    const { data, error } = await supabase.from('stores').insert({
      owner_id: session.user.id,
      store_name: storeForm.name.trim(),
      whatsapp_number: cleanWhatsapp,
      store_slug: `${baseSlug}-${session.user.id.slice(0, 6)}`,
    }).select().single();

    if (error) setMessage(error.message);
    else setStore(data);
    setStatus('idle');
  };

  const selectImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage('Choose a JPEG, PNG or WebP under 5 MB.');
      return;
    }

    try {
      const compressed = await compressImage(file);
      visualGeneration.current += 1;
      setVisualStatus('idle');
      setImage(compressed);
      setSelectedVisual(compressed);
      setVisuals([]);
      setProduct(null);
      setMessage('Image ready. Generate the listing and optional model visuals.');
    } catch (error) {
      setMessage(error.message);
    }
  };

  const generateProduct = async () => {
    if (!image) return setMessage('Choose a product photo first.');
    setStatus('generating');
    setMessage('Anya is merchandising your product…');
    try {
      const response = await fetch('/api/merchandise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProduct(data.product);
      setMessage('Listing ready. Edit anything before publishing.');
    } catch (error) {
      setProduct(fallbackProduct);
      setMessage(`${error.message} Editable fallback loaded.`);
    } finally {
      setStatus('idle');
    }
  };

  const generateVisuals = async () => {
    if (!image) return setMessage('Choose a saree photo first.');
    const remaining = Math.min(visualCount, 5 - visuals.length);
    if (remaining < 1) return setMessage('You already have five model looks. Choose your favourite and publish.');
    const run = ++visualGeneration.current;
    setVisualStatus('generating');
    setMessage(`Nano Banana is creating ${remaining} optional model look${remaining > 1 ? 's' : ''}. You can publish the original now.`);
    try {
      const generated = [];
      for (let index = 0; index < remaining; index += 1) {
        setMessage(`Creating optional look ${index + 1} of ${remaining}… publishing stays available.`);
        const response = await fetch('/api/visuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (run !== visualGeneration.current) return;
        generated.push(...data.visuals);
        setVisuals((current) => [...current, ...data.visuals].slice(0, 5));
      }
      if (run === visualGeneration.current) {
        setMessage(`${generated.length} model look${generated.length === 1 ? ' is' : 's are'} ready. Choose one, or keep the original.`);
      }
    } catch (error) {
      if (run === visualGeneration.current) setMessage(`${error.message} Keep the original selected and publish normally.`);
    } finally {
      if (run === visualGeneration.current) setVisualStatus('idle');
    }
  };

  const publish = async () => {
    if (!product || !selectedVisual || !store) return;
    visualGeneration.current += 1;
    setVisualStatus('idle');
    setStatus('publishing');
    setMessage('Publishing to your storefront…');
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ accessToken: session.access_token, storeId: store.id, image: selectedVisual, product }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Product publishing failed.');

      setProducts((current) => [data.product, ...current.filter((item) => item.id !== data.product.id)]);
      await loadProducts(store.id);
      setImage('');
      setSelectedVisual('');
      setVisuals([]);
      setProduct(null);
      setMessage(data.bundle ? 'Published with a complementary bundle. Your storefront is live.' : 'Published. Add one more product to create an automatic bundle.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setStatus('idle');
    }
  };

  const logout = async () => {
    await createClient().auth.signOut();
    window.location.reload();
  };

  if (loading) return <main className={styles.loading}>Opening your studio…</main>;
  if (!session) return <AuthPanel />;

  if (!store) {
    return (
      <main className={styles.onboarding}>
        <form onSubmit={createStore}>
          <span>First things first</span>
          <h1>Name your storefront.</h1>
          <p>This becomes your public boutique identity and WhatsApp checkout destination.</p>
          <label>Store name<input value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value })} placeholder="e.g. House of Anya" required /></label>
          <label>WhatsApp with country code<input value={storeForm.whatsapp} onChange={(event) => setStoreForm({ ...storeForm, whatsapp: event.target.value })} placeholder="919876543210" required /></label>
          <button disabled={status === 'saving'}>{status === 'saving' ? 'Creating…' : 'Create storefront'}</button>
          {message && <small>{message}</small>}
        </form>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <nav>
        <Link href="/" className={styles.brand}>Anya<span>.</span></Link>
        <div><Link href={`/shop?store=${store.store_slug}`} className={styles.storeLink}>View storefront ↗</Link><button onClick={logout}>Sign out</button></div>
      </nav>

      <header>
        <span>{store.store_name} · Seller studio</span>
        <h1>Style it.<br /><em>Publish it.</em></h1>
        <p>Upload a saree, let Anya merchandise it, then create model-worn visuals with Nano Banana.</p>
      </header>

      <section className={styles.workspace}>
        <div className={styles.uploadCard}>
          <label className={`${styles.dropzone} ${image ? styles.hasImage : ''}`}>
            {image ? <Image src={image} alt="Product preview" fill unoptimized sizes="(max-width: 820px) 100vw, 42vw" /> : <div><strong>Drop your saree photo</strong><span>JPEG, PNG or WebP · max 5 MB</span></div>}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
          </label>
          <div className={styles.generationActions}>
            <button className={styles.generate} onClick={generateProduct} disabled={!image || status === 'generating' || status === 'publishing'}>{status === 'generating' ? 'Generating listing…' : 'Generate product details'}</button>
            <div className={styles.visualControl}>
              <select value={visualCount} onChange={(event) => setVisualCount(Number(event.target.value))} aria-label="Number of model visuals">
                {[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} visual{count > 1 ? 's' : ''}</option>)}
              </select>
              <button onClick={generateVisuals} disabled={!image || visualStatus === 'generating' || visuals.length >= 5}>{visualStatus === 'generating' ? 'Creating optional looks…' : visuals.length ? 'Add model looks' : 'Generate model looks'}</button>
            </div>
          </div>
          {message && <p className={styles.message}>{message}</p>}
        </div>

        <AnimatePresence mode="wait">
          {product ? (
            <motion.div className={styles.editor} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
              <span className={styles.ready}>Ready to publish</span>
              <label>Product name<input value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} /></label>
              <label>Description<textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label>
              <div className={styles.row}>
                <label>Price (₹)<input type="number" min="1" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label>
                <label>Category<input value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} /></label>
              </div>
              <div className={styles.tags}>{product.vibeTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <button className={styles.publish} onClick={publish} disabled={status === 'publishing'}>{status === 'publishing' ? 'Publishing…' : 'Publish to storefront ↗'}</button>
            </motion.div>
          ) : <div className={styles.empty}><span>✦</span><p>Your generated product details will appear here.</p></div>}
        </AnimatePresence>
      </section>

      {(visuals.length > 0 || image) && (
        <section className={styles.visualsSection}>
          <div><span>Product visual</span><h2>Choose what customers see.</h2><p>The original is always available. Nano Banana looks are optional.</p></div>
          <div className={styles.visualGrid}>
            {[image, ...visuals].filter(Boolean).map((visual, index) => (
              <button key={`${visual.slice(-28)}-${index}`} className={selectedVisual === visual ? styles.selected : ''} onClick={() => setSelectedVisual(visual)}>
                <Image src={visual} alt={index === 0 ? 'Original product' : `Generated model look ${index}`} fill unoptimized sizes="(max-width: 560px) 50vw, 220px" />
                <span>{index === 0 ? 'Original' : `Look ${index}`}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={styles.inventory}>
        <div><span>Live inventory</span><h2>{products.length} product{products.length === 1 ? '' : 's'} published.</h2></div>
        {products.length ? (
          <div className={styles.inventoryGrid}>{products.map((item) => <article key={item.id}><div><Image src={item.image_url} alt={item.title} fill sizes="120px" /></div><span>{item.title}<small>₹{Number(item.price).toLocaleString('en-IN')}</small></span></article>)}</div>
        ) : <p className={styles.noProducts}>Your first published product will show up here.</p>}
      </section>
    </main>
  );
}
