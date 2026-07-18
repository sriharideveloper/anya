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
  compareAtPrice: 2999,
  stockQuantity: 5,
  category: 'Saree',
  occasion: 'Festive celebrations',
  targetAudience: 'Festive shoppers and saree lovers',
  confidence: 97,
  insight: 'This product is likely to perform well during festive shopping because of its vibrant colour palette and traditional styling.',
  vibeTags: ['Fresh Find', 'Evening Edit', 'Quiet Luxury'],
};

const GENERATION_STAGES = [
  '🧠 Reading garment…',
  '🎨 Detecting colours…',
  '✨ Naming collection…',
  '💰 Estimating value…',
  '🏷️ Creating vibe tags…',
  '🛍️ Building storefront…',
];

function premiumProduct(product) {
  const category = product?.category || 'Boutique edit';
  const tags = Array.isArray(product?.vibeTags) ? product.vibeTags : [];
  return {
    ...product,
    category,
    vibeTags: tags,
    occasion: product?.occasion || tags[0] || 'Festive celebrations',
    targetAudience: product?.targetAudience || 'Festive shoppers and style-led buyers',
    confidence: Number(product?.confidence) || 97,
    stockQuantity: Number.isFinite(Number(product?.stockQuantity)) ? Number(product.stockQuantity) : 5,
    compareAtPrice: product?.compareAtPrice || '',
    insight: product?.insight || `This ${category.toLowerCase()} is likely to perform well during festive shopping because of its distinctive styling and boutique-ready presentation.`,
  };
}

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
  const [generationStage, setGenerationStage] = useState(0);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [inventorySaving, setInventorySaving] = useState('');
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

  useEffect(() => {
    if (status !== 'generating') return undefined;
    setGenerationStage(0);
    const interval = window.setInterval(() => {
      setGenerationStage((current) => Math.min(current + 1, GENERATION_STAGES.length - 1));
    }, 900);
    return () => window.clearInterval(interval);
  }, [status]);

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
    const startedAt = performance.now();
    setStatus('generating');
    setMessage(GENERATION_STAGES[0]);
    try {
      const response = await fetch('/api/merchandise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, mimeType: 'image/jpeg' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProduct(premiumProduct(data.product));
      setGenerationSeconds((performance.now() - startedAt) / 1000);
      setMessage('Listing ready. Edit anything before publishing.');
    } catch (error) {
      setProduct(premiumProduct(fallbackProduct));
      setGenerationSeconds((performance.now() - startedAt) / 1000);
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

  const updateInventoryDraft = (productId, field, value) => {
    setProducts((current) => current.map((item) => (item.id === productId ? { ...item, [field]: value } : item)));
  };

  const saveInventoryItem = async (item) => {
    const stockQuantity = Math.max(0, Number(item.stock_quantity) || 0);
    const price = Number(item.price);
    const compareAtPrice = item.compare_at_price === '' || item.compare_at_price == null ? null : Number(item.compare_at_price);
    setInventorySaving(item.id);
    setMessage(`Saving ${item.title}…`);
    try {
      const response = await fetch(`/api/products/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          accessToken: session.access_token,
          stockQuantity,
          price,
          compareAtPrice,
          isActive: item.is_active !== false,
          title: item.title,
          description: item.description,
          category: item.category,
          occasion: item.occasion,
          vibeTags: item.vibe_tags || [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Inventory update failed.');
      setProducts((current) => current.map((productItem) => (productItem.id === item.id ? data.product : productItem)));
      setMessage(stockQuantity === 0 ? `${item.title} is now marked sold out.` : `${item.title} inventory updated.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setInventorySaving('');
    }
  };

  const toggleInventoryVisibility = async (item) => {
    const nextActive = item.is_active === false;
    setInventorySaving(item.id);
    try {
      const response = await fetch(`/api/products/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ accessToken: session.access_token, isActive: nextActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Visibility update failed.');
      setProducts((current) => current.map((productItem) => (productItem.id === item.id ? data.product : productItem)));
      setMessage(nextActive ? `${item.title} is visible in the storefront.` : `${item.title} is hidden from customers.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setInventorySaving('');
    }
  };

  const deleteInventoryItem = async (item) => {
    if (!window.confirm(`Permanently delete “${item.title}”? This cannot be undone.`)) return;
    setInventorySaving(item.id);
    try {
      const response = await fetch(`/api/products/${item.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ accessToken: session.access_token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Product deletion failed.');
      setProducts((current) => current.filter((productItem) => productItem.id !== item.id));
      setMessage(`${item.title} was permanently deleted.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setInventorySaving('');
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
            <button className={styles.generate} onClick={generateProduct} disabled={!image || status === 'generating' || status === 'publishing'}>{status === 'generating' ? GENERATION_STAGES[generationStage] : 'Generate product details'}</button>
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
              <div className={styles.previewHeader}><span className={styles.ready}>✨ AI Generated · Ready to publish</span><strong>★★★★★ AI Merchandising</strong></div>
              <label>Product name<input value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} /></label>
              <label>Description<textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label>
              <div className={styles.row}>
                <label>Price (₹)<input type="number" min="1" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} /></label>
                <label>Original price (₹)<input type="number" min="1" value={product.compareAtPrice} onChange={(event) => setProduct({ ...product, compareAtPrice: event.target.value })} placeholder="Optional" /></label>
              </div>
              <div className={styles.row}>
                <label>Stock quantity<input type="number" min="0" value={product.stockQuantity} onChange={(event) => setProduct({ ...product, stockQuantity: event.target.value })} /></label>
                <label>Category<input value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} /></label>
              </div>
              <label>Occasion<input value={product.occasion} onChange={(event) => setProduct({ ...product, occasion: event.target.value })} /></label>
              <div className={styles.tags}>{product.vibeTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <aside className={styles.aiCard}>
                <div><span>✨ AI Merchandising</span><strong>Confidence {product.confidence}%</strong></div>
                <dl>
                  <div><dt>Occasion</dt><dd>{product.occasion}</dd></div>
                  <div><dt>Target audience</dt><dd>{product.targetAudience}</dd></div>
                  <div><dt>Price recommendation</dt><dd>₹{Number(product.price).toLocaleString('en-IN')}</dd></div>
                  <div><dt>Generated in</dt><dd>{generationSeconds.toFixed(1)}s</dd></div>
                </dl>
                <blockquote><span>AI insight</span>{product.insight}</blockquote>
              </aside>
              <button className={styles.publish} onClick={publish} disabled={status === 'publishing'}>{status === 'publishing' ? 'Publishing…' : 'Publish to storefront ↗'}</button>
            </motion.div>
          ) : status === 'generating' ? (
            <div className={styles.generationPanel}>
              <span>✨ AI merchandising in progress</span>
              <h2>{GENERATION_STAGES[generationStage]}</h2>
              <div className={styles.progress}><i style={{ width: `${((generationStage + 1) / GENERATION_STAGES.length) * 100}%` }} /></div>
              <ol>{GENERATION_STAGES.map((stage, index) => <li key={stage} className={index <= generationStage ? styles.stageDone : ''}>{stage}</li>)}</ol>
            </div>
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
          <div className={styles.inventoryGrid}>{products.map((item) => (
            <article key={item.id} className={item.is_active === false ? styles.hiddenProduct : ''}>
              <Link href={`/product/${item.id}`} className={styles.inventoryImage} title="Open public product page"><Image src={item.image_url} alt={item.title} fill sizes="120px" /></Link>
              <div className={styles.inventoryInfo}>
                <Link href={`/product/${item.id}`}>{item.title}</Link>
                <small>{item.is_active === false ? 'Hidden from storefront' : Number(item.stock_quantity ?? 1) === 0 ? 'Sold out' : Number(item.stock_quantity ?? 1) <= 3 ? `Only ${item.stock_quantity ?? 1} left` : `${item.stock_quantity ?? 1} in stock`}</small>
              </div>
              <details className={styles.inventoryEditor}>
                <summary>Edit product & inventory</summary>
                <div className={styles.inventoryDetails}>
                  <label className={styles.wideField}>Product name<input value={item.title} onChange={(event) => updateInventoryDraft(item.id, 'title', event.target.value)} /></label>
                  <label>Category<input value={item.category || ''} onChange={(event) => updateInventoryDraft(item.id, 'category', event.target.value)} /></label>
                  <label>Occasion<input value={item.occasion || ''} onChange={(event) => updateInventoryDraft(item.id, 'occasion', event.target.value)} /></label>
                  <label>Stock<input type="number" min="0" value={item.stock_quantity ?? 1} onChange={(event) => updateInventoryDraft(item.id, 'stock_quantity', event.target.value)} /></label>
                  <label>Sale ₹<input type="number" min="1" value={item.price} onChange={(event) => updateInventoryDraft(item.id, 'price', event.target.value)} /></label>
                  <label>Was ₹<input type="number" min="1" value={item.compare_at_price ?? ''} placeholder="Optional" onChange={(event) => updateInventoryDraft(item.id, 'compare_at_price', event.target.value)} /></label>
                  <label className={styles.wideField}>Vibe tags<input value={(item.vibe_tags || []).join(', ')} onChange={(event) => updateInventoryDraft(item.id, 'vibe_tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} /></label>
                  <label className={styles.wideField}>Description<textarea value={item.description || ''} onChange={(event) => updateInventoryDraft(item.id, 'description', event.target.value)} /></label>
                </div>
                <div className={styles.managementActions}>
                  <button onClick={() => saveInventoryItem(item)} disabled={inventorySaving === item.id}>{inventorySaving === item.id ? 'Saving…' : 'Save changes'}</button>
                  <button onClick={() => toggleInventoryVisibility(item)} disabled={inventorySaving === item.id}>{item.is_active === false ? 'Show in store' : 'Hide from store'}</button>
                  <button className={styles.deleteButton} onClick={() => deleteInventoryItem(item)} disabled={inventorySaving === item.id}>Delete forever</button>
                </div>
              </details>
            </article>
          ))}</div>
        ) : <p className={styles.noProducts}>Your first published product will show up here.</p>}
      </section>
    </main>
  );
}
