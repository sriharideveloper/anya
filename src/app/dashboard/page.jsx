'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import AuthPanel from '@/components/AuthPanel/AuthPanel';
import { createClient } from '@/lib/supabase/client';
import styles from './Dashboard.module.scss';

const fallbackProduct = {
  title: 'Untitled boutique piece',
  description: 'Add a truthful product description before publishing.',
  price: '',
  priceSuggestion: null,
  compareAtPrice: '',
  stockQuantity: '',
  category: 'Boutique edit',
  categoryPath: [],
  audienceTags: [],
  occasion: '',
  targetAudience: '',
  confidence: null,
  insight: '',
  attributes: {},
  vibeTags: [],
  variants: [],
};

const GENERATION_STAGES = [
  '🧠 Reading garment…',
  '🎨 Detecting colours…',
  '✨ Naming collection…',
  '💰 Estimating value…',
  '🏷️ Creating vibe tags…',
  '🛍️ Building storefront…',
];
const SELLER_PRODUCT_FIELDS = 'id,store_id,image_url,title,description,price,compare_at_price,stock_quantity,category,category_path,vibe_tags,audience_tags,occasion,color_palette,attributes,ai_generated,is_active,view_count,created_at,updated_at';

function premiumProduct(product) {
  const category = product?.category || 'Boutique edit';
  const tags = Array.isArray(product?.vibeTags) ? product.vibeTags : [];
  const suggestedPrice = Number(product?.priceSuggestion ?? product?.suggestedPrice ?? product?.price);
  return {
    ...product,
    category,
    vibeTags: tags,
    categoryPath: Array.isArray(product?.categoryPath) ? product.categoryPath : [],
    audienceTags: Array.isArray(product?.audienceTags) ? product.audienceTags : [],
    attributes: product?.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes) ? product.attributes : {},
    occasion: product?.occasion || tags[0] || '',
    targetAudience: product?.targetAudience || '',
    confidence: Number.isFinite(Number(product?.confidence)) ? Number(product.confidence) : null,
    priceSuggestion: Number.isFinite(suggestedPrice) && suggestedPrice >= 0 ? suggestedPrice : null,
    price: '',
    stockQuantity: '',
    compareAtPrice: product?.compareAtPrice || '',
    insight: product?.insight || '',
    variants: Array.isArray(product?.variants) ? product.variants : [],
  };
}

function optionsToText(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
  return Object.entries(options).map(([name, value]) => `${name}=${value}`).join(', ');
}

function optionsFromText(value) {
  return Object.fromEntries(
    String(value || '')
      .split(',')
      .map((pair) => pair.split('='))
      .map(([name, ...rest]) => [String(name || '').trim(), rest.join('=').trim()])
      .filter(([name, option]) => name && option),
  );
}

function VariantEditor({ variants, onChange }) {
  const rows = Array.isArray(variants) ? variants : [];
  const update = (index, changes) => onChange(rows.map((variant, itemIndex) => (itemIndex === index ? { ...variant, ...changes } : variant)));

  return (
    <section className={styles.variantEditor}>
      <div><span>Variants · optional</span><p>Use flexible options such as Size=M, Colour=Wine. Stock is never guessed.</p></div>
      {rows.map((variant, index) => (
        <div className={styles.variantRow} key={variant.id || `new-${index}`}>
          <label>Options<input value={optionsToText(variant.options)} onChange={(event) => update(index, { options: optionsFromText(event.target.value) })} placeholder="Size=M, Colour=Wine" /></label>
          <label>Variant price ₹<input type="number" min="0" value={variant.price ?? ''} onChange={(event) => update(index, { price: event.target.value })} placeholder="Uses base price" /></label>
          <label>Stock<input type="number" min="0" value={variant.stockQuantity ?? ''} onChange={(event) => update(index, { stockQuantity: event.target.value })} /></label>
          <button type="button" onClick={() => onChange(rows.filter((_item, itemIndex) => itemIndex !== index))}>Remove</button>
        </div>
      ))}
      <button type="button" className={styles.addVariant} onClick={() => onChange([...rows, { options: {}, price: '', stockQuantity: '' }])}>+ Add a variant</button>
    </section>
  );
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error('Could not process the image.'));
      image.onload = () => {
        const max = 960;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadPublishMedia({ userId, references, generatedVisuals, visibleVisuals, cover }) {
  const supabase = createClient();
  const visible = new Set([cover, ...visibleVisuals]);
  const sources = [
    ...references.map((dataUrl, index) => ({ dataUrl, kind: 'seller_reference', index })),
    ...generatedVisuals.map((dataUrl, index) => ({ dataUrl, kind: 'ai_visual', index })),
  ].filter((item, index, all) => all.findIndex((candidate) => candidate.dataUrl === item.dataUrl) === index);
  const uploaded = [];

  try {
    for (const source of sources) {
      const isVisible = visible.has(source.dataUrl);
      const bucket = isVisible ? 'product-images' : 'product-references';
      let blob = await fetch(source.dataUrl).then((response) => response.blob());
      if (blob.size > 4.5 * 1024 * 1024) {
        const compressed = await compressImage(blob);
        blob = await fetch(compressed).then((response) => response.blob());
      }
      const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        cacheControl: isVisible ? '31536000' : '3600',
        upsert: false,
      });

      if (error) {
        if (!isVisible && /bucket|not found|404/i.test(error.message || '')) continue;
        throw new Error(`Could not upload ${isVisible ? 'a storefront visual' : 'a private reference'}: ${error.message}`);
      }

      const publicUrl = isVisible ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : '';
      uploaded.push({
        bucket,
        path,
        publicUrl,
        kind: source.kind,
        isVisible,
        isCover: source.dataUrl === cover,
        sortOrder: source.index,
      });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(
      [...new Set(uploaded.map((item) => item.bucket))].map((bucket) => (
        supabase.storage.from(bucket).remove(uploaded.filter((item) => item.bucket === bucket).map((item) => item.path))
      )),
    );
    throw error;
  }
}

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function storeSettings(store) {
  return {
    storeName: store?.store_name || '',
    tagline: store?.tagline || '',
    whatsapp: store?.whatsapp_number || '',
    bargainMode: Boolean(store?.bargain_mode),
    malayalamMode: Boolean(store?.malayalam_mode),
  };
}

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [stores, setStores] = useState([]);
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeForm, setStoreForm] = useState({ name: '', whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '' });
  const [image, setImage] = useState('');
  const [referenceImages, setReferenceImages] = useState([]);
  const [product, setProduct] = useState(null);
  const [visuals, setVisuals] = useState([]);
  const [visibleVisuals, setVisibleVisuals] = useState([]);
  const [selectedVisual, setSelectedVisual] = useState('');
  const [visualCount, setVisualCount] = useState(1);
  const [visualStatus, setVisualStatus] = useState('idle');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [generationStage, setGenerationStage] = useState(0);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const [pipelineMeta, setPipelineMeta] = useState({ merchandise: null, visuals: null });
  const [inventorySaving, setInventorySaving] = useState('');
  const [settingsForm, setSettingsForm] = useState(() => storeSettings());
  const [settingsStatus, setSettingsStatus] = useState('idle');
  const [settingsFeedback, setSettingsFeedback] = useState({ type: '', text: '' });
  const [showStoreCreator, setShowStoreCreator] = useState(false);
  const visualGeneration = useRef(0);

  const loadProducts = useCallback(async (storeId) => {
    const supabase = createClient();
    const { data } = await supabase.from('products').select(SELLER_PRODUCT_FIELDS).eq('store_id', storeId).order('created_at', { ascending: false });
    const productRows = data || [];
    if (!productRows.length) {
      setProducts([]);
      return;
    }
    const { data: variantRows, error: variantError } = await supabase.from('product_variants').select('*').in('product_id', productRows.map((item) => item.id));
    const variantsByProduct = new Map();
    if (!variantError) {
      (variantRows || []).forEach((variant) => {
        const current = variantsByProduct.get(variant.product_id) || [];
        current.push({
          id: variant.id,
          options: variant.option_values || {},
          price: variant.price ?? '',
          stockQuantity: variant.stock_quantity,
          isActive: variant.is_active !== false,
        });
        variantsByProduct.set(variant.product_id, current);
      });
    }
    setProducts(productRows.map((item) => ({ ...item, variants: variantsByProduct.get(item.id) || [] })));
  }, []);

  const loadSeller = useCallback(async (activeSession) => {
    if (!activeSession?.user) {
      setSession(null);
      setStores([]);
      setStore(null);
      setSettingsForm(storeSettings());
      setLoading(false);
      return;
    }

    setSession(activeSession);
    const supabase = createClient();
    const { data } = await supabase.from('stores').select('*').eq('owner_id', activeSession.user.id).order('created_at', { ascending: true });
    const sellerStores = data || [];
    const rememberedStoreId = window.localStorage.getItem('anya-active-store');
    const activeStore = sellerStores.find((item) => item.id === rememberedStoreId) || sellerStores[0] || null;
    setStores(sellerStores);
    setStore(activeStore);
    setSettingsForm(storeSettings(activeStore));
    if (activeStore) await loadProducts(activeStore.id);
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

  const switchStore = async (storeId) => {
    const nextStore = stores.find((item) => item.id === storeId);
    if (!nextStore || nextStore.id === store?.id) return;
    setStore(nextStore);
    setSettingsForm(storeSettings(nextStore));
    setProducts([]);
    setMessage('');
    window.localStorage.setItem('anya-active-store', nextStore.id);
    await loadProducts(nextStore.id);
  };

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
      store_slug: `${baseSlug}-${session.user.id.slice(0, 6)}-${Date.now().toString(36).slice(-4)}`,
    }).select().single();

    if (error) setMessage(error.message);
    else {
      setStores((current) => [...current, data]);
      setStore(data);
      setSettingsForm(storeSettings(data));
      window.localStorage.setItem('anya-active-store', data.id);
      setProducts([]);
      setShowStoreCreator(false);
      setStoreForm({ name: '', whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '' });
      setMessage('Storefront created. Add its first product.');
    }
    setStatus('idle');
  };

  const selectImage = async (event) => {
    const files = [...(event.target.files || [])].slice(0, 3);
    if (!files.length) return;
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage('Choose one to three JPEG, PNG or WebP images, each under 5 MB.');
      return;
    }

    try {
      const compressed = await Promise.all(files.map(compressImage));
      visualGeneration.current += 1;
      setVisualStatus('idle');
      setReferenceImages(compressed);
      setImage(compressed[0]);
      setSelectedVisual(compressed[0]);
      setVisibleVisuals([compressed[0]]);
      setVisuals([]);
      setProduct(null);
      setMessage(`${compressed.length} reference image${compressed.length === 1 ? '' : 's'} ready. The first is the cover; Anya will treat them as the same product.`);
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
        body: JSON.stringify({ accessToken: session.access_token, image, images: referenceImages, mimeType: 'image/jpeg' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setProduct(premiumProduct(data.product));
      setPipelineMeta((current) => ({ ...current, merchandise: data.meta || null }));
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
    if (!image) return setMessage('Choose a product photo first.');
    const remaining = Math.min(visualCount, 5 - visuals.length);
    if (remaining < 1) return setMessage('You already have five model looks. Choose your favourite and publish.');
    const run = ++visualGeneration.current;
    setVisualStatus('generating');
    setMessage(`Nano Banana is creating ${remaining} optional model look${remaining > 1 ? 's' : ''}. You can publish the original now.`);
    try {
      const generated = [];
      let failureMessage = '';
      let latestMeta = null;
      for (let index = 0; index < remaining; index += 1) {
        setMessage(`Creating optional visual ${index + 1} of ${remaining}… completed looks are kept safely.`);
        const response = await fetch('/api/visuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({
            accessToken: session.access_token,
            image,
            images: referenceImages,
            mimeType: 'image/jpeg',
            count: 1,
            variationIndex: visuals.length + index,
            product,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          failureMessage = data.error || 'One visual could not be created.';
          break;
        }
        if (run !== visualGeneration.current) return;
        const visual = data.visuals?.[0];
        if (!visual) {
          failureMessage = 'One visual could not be created.';
          break;
        }
        generated.push(visual);
        latestMeta = data.meta || latestMeta;
        setVisuals((current) => [...current, visual].slice(0, 5));
      }
      if (!generated.length) throw new Error(failureMessage || 'Visuals could not be created.');
      setPipelineMeta((current) => ({ ...current, visuals: latestMeta }));
      if (run === visualGeneration.current) {
        setMessage(failureMessage
          ? `${generated.length} visual${generated.length === 1 ? '' : 's'} ready. ${failureMessage}`
          : `${generated.length} model look${generated.length === 1 ? ' is' : 's are'} ready. Choose one, or keep the original.`);
      }
    } catch (error) {
      if (run === visualGeneration.current) setMessage(`${error.message} Keep the original selected and publish normally.`);
    } finally {
      if (run === visualGeneration.current) setVisualStatus('idle');
    }
  };

  const publish = async () => {
    if (!product || !selectedVisual || !store) return;
    if (!product.title?.trim() || !product.description?.trim() || !Number.isFinite(Number(product.price)) || Number(product.price) < 0) {
      setMessage('Confirm a title, description, and selling price before publishing.');
      return;
    }
    if (!Number.isInteger(Number(product.stockQuantity)) || Number(product.stockQuantity) < 0) {
      setMessage('Enter the real stock quantity before publishing.');
      return;
    }
    visualGeneration.current += 1;
    setVisualStatus('idle');
    setStatus('publishing');
    setMessage('Uploading the verified gallery…');
    let uploadedMedia = [];
    try {
      uploadedMedia = await uploadPublishMedia({
        userId: session.user.id,
        references: referenceImages,
        generatedVisuals: visuals,
        visibleVisuals,
        cover: selectedVisual,
      });
      const coverMedia = uploadedMedia.find((item) => item.isCover && item.publicUrl) || uploadedMedia.find((item) => item.publicUrl);
      if (!coverMedia) throw new Error('Choose at least one public storefront visual.');
      setMessage('Publishing the verified listing…');
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          accessToken: session.access_token,
          storeId: store.id,
          imageUrl: coverMedia.publicUrl,
          media: uploadedMedia,
          product,
          generation: {
            durationSeconds: generationSeconds,
            referenceCount: referenceImages.length,
            requestedCount: visuals.length,
            modelName: pipelineMeta.visuals?.model || pipelineMeta.merchandise?.model || null,
            promptVersion: pipelineMeta.visuals?.promptVersion || pipelineMeta.merchandise?.promptVersion || null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Product publishing failed.');

      setProducts((current) => [data.product, ...current.filter((item) => item.id !== data.product.id)]);
      await loadProducts(store.id);
      setImage('');
      setReferenceImages([]);
      setSelectedVisual('');
      setVisuals([]);
      setVisibleVisuals([]);
      setProduct(null);
      setPipelineMeta({ merchandise: null, visuals: null });
      setMessage(data.bundle ? 'Published with a complementary bundle. Your storefront is live.' : 'Published. Add one more product to create an automatic bundle.');
    } catch (error) {
      if (uploadedMedia.length) {
        const supabase = createClient();
        await Promise.all(
          [...new Set(uploadedMedia.map((item) => item.bucket))].map((bucket) => (
            supabase.storage.from(bucket).remove(uploadedMedia.filter((item) => item.bucket === bucket).map((item) => item.path))
          )),
        );
      }
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
          variants: item.variants || [],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Inventory update failed.');
      const normalizedProduct = {
        ...data.product,
        variants: (data.product.variants || item.variants || []).map((variant) => ({
          id: variant.id,
          options: variant.option_values || variant.options || {},
          price: variant.price ?? '',
          stockQuantity: variant.stock_quantity ?? variant.stockQuantity ?? '',
          isActive: variant.is_active !== false && variant.isActive !== false,
        })),
      };
      setProducts((current) => current.map((productItem) => (productItem.id === item.id ? normalizedProduct : productItem)));
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
      setProducts((current) => current.map((productItem) => (productItem.id === item.id ? { ...data.product, variants: productItem.variants || [] } : productItem)));
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

  const saveStoreSettings = async (event) => {
    event.preventDefault();
    const cleanWhatsapp = settingsForm.whatsapp.replace(/\D/g, '');
    const storeName = settingsForm.storeName.trim();
    const tagline = settingsForm.tagline.trim();

    if (!storeName || storeName.length > 100) {
      setSettingsFeedback({ type: 'error', text: 'Store name must be between 1 and 100 characters.' });
      return;
    }
    if (tagline.length > 180) {
      setSettingsFeedback({ type: 'error', text: 'Tagline must be 180 characters or fewer.' });
      return;
    }
    if (!/^\d{10,15}$/.test(cleanWhatsapp)) {
      setSettingsFeedback({ type: 'error', text: 'Add a WhatsApp number with its country code.' });
      return;
    }

    setSettingsStatus('saving');
    setSettingsFeedback({ type: '', text: '' });
    try {
      const response = await fetch(`/api/stores/${store.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          accessToken: session.access_token,
          storeName,
          tagline,
          whatsapp: cleanWhatsapp,
          bargainMode: settingsForm.bargainMode,
          malayalamMode: settingsForm.malayalamMode,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Store settings could not be saved.');

      setStore(data.store);
      setStores((current) => current.map((item) => (item.id === data.store.id ? data.store : item)));
      setSettingsForm(storeSettings(data.store));
      setSettingsFeedback({ type: 'success', text: 'Saved. Your public storefront is up to date.' });
    } catch (error) {
      setSettingsFeedback({ type: 'error', text: error.message });
    } finally {
      setSettingsStatus('idle');
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

  const liveProductCount = products.filter((item) => item.is_active !== false).length;
  const totalStock = products.reduce((sum, item) => {
    if (item.variants?.length) {
      return sum + item.variants.reduce((variantSum, variant) => variantSum + Math.max(0, Number(variant.stockQuantity) || 0), 0);
    }
    return sum + Math.max(0, Number(item.stock_quantity ?? 0) || 0);
  }, 0);
  const totalViews = products.reduce((sum, item) => sum + Math.max(0, Number(item.view_count) || 0), 0);

  return (
    <main className={styles.page}>
      <nav>
        <Link href="/" className={styles.brand}>Anya<span>.</span></Link>
        <div className={styles.navActions}>
          <label className={styles.storeSwitcher}>
            <span className={styles.srOnly}>Active storefront</span>
            <select value={store.id} onChange={(event) => switchStore(event.target.value)}>
              {stores.map((item) => <option value={item.id} key={item.id}>{item.store_name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setShowStoreCreator((current) => !current)}>+ Store</button>
          <Link href={`/shop?store=${store.store_slug}`} className={styles.storeLink}>View storefront ↗</Link>
          <button onClick={logout}>Sign out</button>
        </div>
      </nav>

      <header>
        <span>{store.store_name} · Seller studio</span>
        <h1>Style it.<br /><em>Publish it.</em></h1>
        <p>Upload one to three views of any fashion product. Anya drafts the listing; you verify every sellable fact before it goes live.</p>
      </header>

      <AnimatePresence>
        {showStoreCreator && (
          <motion.section className={styles.inlineStoreCreator} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <form onSubmit={createStore}>
              <div><span>Another storefront</span><h2>Start a distinct boutique.</h2></div>
              <label>Store name<input value={storeForm.name} onChange={(event) => setStoreForm({ ...storeForm, name: event.target.value })} required /></label>
              <label>WhatsApp with country code<input value={storeForm.whatsapp} onChange={(event) => setStoreForm({ ...storeForm, whatsapp: event.target.value })} required /></label>
              <button disabled={status === 'saving'}>{status === 'saving' ? 'Creating…' : 'Create storefront'}</button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.section
        className={styles.storeSettings}
        aria-labelledby="store-settings-title"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
        <div className={styles.settingsHeader}>
          <div>
            <span>Store settings</span>
            <h2 id="store-settings-title">Your shop, in your voice.</h2>
          </div>
          <p>Changes appear on your live storefront.</p>
        </div>
        <form onSubmit={saveStoreSettings}>
          <div className={styles.settingsFields}>
            <label>
              Store name
              <input
                value={settingsForm.storeName}
                onChange={(event) => setSettingsForm({ ...settingsForm, storeName: event.target.value })}
                maxLength={100}
                autoComplete="organization"
                required
              />
            </label>
            <label>
              Store tagline
              <input
                value={settingsForm.tagline}
                onChange={(event) => setSettingsForm({ ...settingsForm, tagline: event.target.value })}
                maxLength={180}
                placeholder="A collection made to be remembered."
              />
            </label>
            <label>
              WhatsApp with country code
              <input
                value={settingsForm.whatsapp}
                onChange={(event) => setSettingsForm({ ...settingsForm, whatsapp: event.target.value })}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="919876543210"
                maxLength={18}
                required
              />
            </label>
          </div>
          <div className={styles.settingsControls}>
            <label className={styles.modeToggle}>
              <input
                type="checkbox"
                checked={settingsForm.bargainMode}
                onChange={(event) => setSettingsForm({ ...settingsForm, bargainMode: event.target.checked })}
              />
              <span className={styles.toggleTrack} aria-hidden="true"><i /></span>
              <span className={styles.toggleCopy}><strong>Bargain mode</strong><small>Invite friendly price conversations.</small></span>
            </label>
            <label className={styles.modeToggle}>
              <input
                type="checkbox"
                checked={settingsForm.malayalamMode}
                onChange={(event) => setSettingsForm({ ...settingsForm, malayalamMode: event.target.checked })}
              />
              <span className={styles.toggleTrack} aria-hidden="true"><i /></span>
              <span className={styles.toggleCopy}><strong>Malayalam mode</strong><small>Welcome local shoppers bilingually.</small></span>
            </label>
            <button type="submit" disabled={settingsStatus === 'saving'}>
              {settingsStatus === 'saving' ? 'Saving...' : 'Save store settings'}
            </button>
          </div>
          {settingsFeedback.text && (
            <p
              className={settingsFeedback.type === 'error' ? styles.settingsError : styles.settingsSuccess}
              role="status"
              aria-live="polite"
            >
              {settingsFeedback.text}
            </p>
          )}
        </form>
      </motion.section>

      <section className={styles.sellerPulse} aria-label="Storefront performance">
        <div><span>Live products</span><strong>{liveProductCount}</strong></div>
        <div><span>Units ready</span><strong>{totalStock}</strong></div>
        <div><span>Product views</span><strong>{totalViews}</strong></div>
        <div><span>Checkout</span><strong>WhatsApp</strong></div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.uploadCard}>
          <label className={`${styles.dropzone} ${image ? styles.hasImage : ''}`}>
            {image ? <><Image src={image} alt="Product preview" fill unoptimized sizes="(max-width: 820px) 100vw, 42vw" /><span className={styles.referenceCount}>{referenceImages.length} same-product view{referenceImages.length === 1 ? '' : 's'}</span></> : <div><strong>Drop 1–3 product photos</strong><span>Same product, different angles · JPEG, PNG or WebP · max 5 MB each</span></div>}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImage} />
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
              <div className={styles.previewHeader}><span className={styles.ready}>✨ AI draft · Seller verification required</span><strong>{product.confidence !== null ? `${product.confidence}% detection confidence` : 'Review every field'}</strong></div>
              <label>Product name<input value={product.title} onChange={(event) => setProduct({ ...product, title: event.target.value })} /></label>
              <label>Description<textarea value={product.description} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label>
              {product.priceSuggestion !== null && (
                <div className={styles.priceSuggestion}>
                  <span>AI price suggestion · not yet applied</span>
                  <strong>₹{Number(product.priceSuggestion).toLocaleString('en-IN')}</strong>
                  <button type="button" onClick={() => setProduct({ ...product, price: product.priceSuggestion })}>Use this suggestion</button>
                </div>
              )}
              <div className={styles.row}>
                <label>Selling price (₹) · confirm<input type="number" min="0" value={product.price} onChange={(event) => setProduct({ ...product, price: event.target.value })} placeholder="Seller-confirmed price" /></label>
                <label>Original price (₹)<input type="number" min="1" value={product.compareAtPrice} onChange={(event) => setProduct({ ...product, compareAtPrice: event.target.value })} placeholder="Optional" /></label>
              </div>
              <div className={styles.row}>
                <label>Real stock quantity · confirm<input type="number" min="0" value={product.stockQuantity} onChange={(event) => setProduct({ ...product, stockQuantity: event.target.value })} placeholder="Never guessed by AI" /></label>
                <label>Category<input value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })} /></label>
              </div>
              <label>Occasion<input value={product.occasion} onChange={(event) => setProduct({ ...product, occasion: event.target.value })} /></label>
              <label>Category path<input value={(product.categoryPath || []).join(' › ')} onChange={(event) => setProduct({ ...product, categoryPath: event.target.value.split('›').map((value) => value.trim()).filter(Boolean) })} placeholder="Fashion › Women › Tops" /></label>
              <label>Vibe tags<input value={product.vibeTags.join(', ')} onChange={(event) => setProduct({ ...product, vibeTags: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></label>
              {Object.keys(product.attributes || {}).length > 0 && (
                <div className={styles.attributeEditor}>
                  <span>Detected attributes · correct anything uncertain</span>
                  {Object.entries(product.attributes).map(([name, value]) => (
                    <label key={name}>{name.replaceAll('_', ' ')}<input value={Array.isArray(value) ? value.join(', ') : String(value)} onChange={(event) => setProduct({ ...product, attributes: { ...product.attributes, [name]: event.target.value } })} /></label>
                  ))}
                </div>
              )}
              <VariantEditor variants={product.variants} onChange={(variants) => setProduct({ ...product, variants })} />
              <aside className={styles.aiCard}>
                <div><span>✨ Seller-only AI notes</span><strong>{product.confidence !== null ? `Confidence ${product.confidence}%` : 'Manual review'}</strong></div>
                <dl>
                  <div><dt>Occasion</dt><dd>{product.occasion}</dd></div>
                  <div><dt>Target audience</dt><dd>{product.targetAudience || 'Not inferred'}</dd></div>
                  <div><dt>Price suggestion</dt><dd>{product.priceSuggestion !== null ? `₹${Number(product.priceSuggestion).toLocaleString('en-IN')}` : 'Seller decides'}</dd></div>
                  <div><dt>Generated in</dt><dd>{generationSeconds.toFixed(1)}s</dd></div>
                </dl>
                {product.insight && <blockquote><span>AI insight</span>{product.insight}</blockquote>}
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
          <div><span>Product gallery</span><h2>Choose the cover and public views.</h2><p>References stay private unless you mark them visible. Generated visuals are always optional.</p></div>
          <div className={styles.visualGrid}>
            {[...referenceImages, ...visuals].filter(Boolean).map((visual, index) => (
              <article key={`${visual.slice(-28)}-${index}`} className={selectedVisual === visual ? styles.selected : ''}>
                <button type="button" className={styles.visualCover} onClick={() => { setSelectedVisual(visual); setVisibleVisuals((current) => [...new Set([...current, visual])]); }}>
                  <Image src={visual} alt={index < referenceImages.length ? `Reference ${index + 1}` : `Generated visual ${index - referenceImages.length + 1}`} fill unoptimized sizes="(max-width: 560px) 50vw, 220px" />
                  <span>{index < referenceImages.length ? `Reference ${index + 1}` : `AI visual ${index - referenceImages.length + 1}`}</span>
                </button>
                <label><input type="checkbox" checked={visibleVisuals.includes(visual)} disabled={selectedVisual === visual} onChange={(event) => setVisibleVisuals((current) => event.target.checked ? [...new Set([...current, visual])] : current.filter((item) => item !== visual))} />{selectedVisual === visual ? 'Public cover' : 'Public'}</label>
              </article>
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
                <VariantEditor variants={item.variants || []} onChange={(variants) => updateInventoryDraft(item.id, 'variants', variants)} />
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
