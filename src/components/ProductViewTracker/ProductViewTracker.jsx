'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ProductViewTracker({ productId }) {
  useEffect(() => {
    if (!productId) return;

    const sessionKey = `anya-product-view:${productId}`;
    try {
      if (window.sessionStorage.getItem(sessionKey)) return;
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Storage can be unavailable in private contexts; analytics stays optional.
    }

    let cancelled = false;
    const recordView = async () => {
      try {
        const { error } = await createClient().rpc('increment_product_view', { target_product_id: productId });
        if (error && !cancelled) {
          try { window.sessionStorage.removeItem(sessionKey); } catch { /* Analytics remains optional. */ }
        }
      } catch {
        if (!cancelled) {
          try { window.sessionStorage.removeItem(sessionKey); } catch { /* Analytics remains optional. */ }
        }
      }
    };

    recordView();
    return () => { cancelled = true; };
  }, [productId]);

  return null;
}
