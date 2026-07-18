# ANYA AI — Agent Rules & Constraints

> **Project**: Anya AI — WhatsApp-First AI Storefront Generator
> **Event**: Kochi Metro Sprint — E-Commerce Track
> **Stack**: Next.js • Supabase • Gemini

---

## 🚫 ABSOLUTE CONSTRAINTS (Never violate these)

1. **NO TypeScript** — JSX only. Files must use `.js` and `.jsx` extensions. Never create `.ts` or `.tsx` files.
2. **SCSS Modules only** — Every component gets `ComponentName.module.scss`. No CSS-in-JS. No Tailwind. No inline styles except for dynamic values.
3. **Next.js App Router** — No Pages Router. Use `app/` directory with `layout.jsx` and `page.jsx` conventions.
4. **No heavy e-commerce patterns** — No cart system, no Stripe, no payment gateway. WhatsApp IS the checkout.
5. **Dark theme ONLY** — No light mode. Premium dark aesthetic with gold accents.
6. **Mobile-first** — All designs must work at 375px. Test responsive at 480px, 768px, 1024px, 1440px.

---

## 🎨 Design Language

### Typography
- **Headings**: `Instrument Serif` (thin/400 weight) — loaded via `next/font/google`
- **Body text**: `Poppins` (300-700 weights) — loaded via `next/font/google`
- CSS variables: `--font-heading` and `--font-body`
- NEVER use default browser fonts

### Color Palette
```
Background:    #0a0a0f (primary), #111118 (secondary), #16161f (card)
Glass:         rgba(22, 22, 31, 0.7) with backdrop-filter: blur(20px)
Text:          #f5f5f7 (primary), #a1a1aa (secondary)
Gold Accent:   #c9a96e (primary), #e8d5b0 (secondary)
Rose:          #f43f5e
Emerald:       #10b981
Border:        rgba(201, 169, 110, 0.15)
```

### Visual Effects
- **Glassmorphism** on all cards: `backdrop-filter: blur(20px)` + subtle border
- **Micro-animations** on every interactive element
- **Hover lift** on cards: `translateY(-8px)` with gold glow shadow
- **Image zoom** on hover: `scale(1.08)` with overflow hidden
- **Gradient backgrounds**: radial gradients with gold and rose tints

### Animation Stack
- **Framer Motion** for all component animations
- **Lenis** (`@studio-freight/lenis`) for smooth scrolling
- Custom easing: `[0.22, 1, 0.36, 1]` (ease-out-quint)
- Stagger children: 0.08s delay between items
- Scroll-triggered reveals using `useInView` with `once: true`

---

## 🏗️ Architecture

### Route Structure
```
app/
├── page.jsx                    # Landing page (public)
├── layout.jsx                  # Root layout (fonts, Lenis, metadata)
├── globals.scss                # Global styles + CSS variables
├── dashboard/
│   ├── page.jsx                # Authenticated owner dashboard
│   └── Dashboard.module.scss
├── shop/
│   └── [storeId]/
│       ├── page.jsx            # Public storefront
│       └── Shop.module.scss
└── api/
    ├── merchandise/route.js    # Gemini product extraction
    ├── search/route.js         # AI smart search
    └── auth/callback/route.js  # Supabase auth callback
```

### Component Organization
```
components/
├── ComponentName/
│   ├── ComponentName.jsx
│   └── ComponentName.module.scss
```
Every component MUST be in its own folder with its own SCSS module.

### Library Files
```
lib/
├── supabase/
│   ├── client.js              # createBrowserClient
│   └── server.js              # createServerClient
├── gemini.js                  # Gemini API wrapper
└── whatsapp.js                # WhatsApp URL generator
```

### Custom Hooks
```
hooks/
├── useProducts.js
├── useAuth.js
└── useSearch.js
```

---

## 🔒 Security & Safety

### API Keys
- All API keys in `.env.local` (gitignored)
- NEVER expose `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` client-side
- Only `NEXT_PUBLIC_` prefixed vars are accessible in browser

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

### Supabase
- Row Level Security (RLS) on ALL tables
- Use `@supabase/ssr` for server-side client creation
- Always check `error` before using `data` in responses
- Handle auth session expiry with redirect

### Gemini
- Always validate JSON responses before parsing
- Strip markdown code fences (```json ... ```) from responses
- Retry up to 2 times on parse failure
- Sanitize user inputs before sending to Gemini
- Set `safetySettings` on the model

### File Uploads
- Max file size: 5MB
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Generate unique filenames using UUID
- Store in Supabase Storage `product-images` bucket

---

## 📦 Dependencies

### Required
```json
{
  "@supabase/supabase-js": "latest",
  "@supabase/ssr": "latest",
  "framer-motion": "latest",
  "@studio-freight/lenis": "latest",
  "sass": "latest",
  "@google/generative-ai": "latest"
}
```

### Dev Dependencies
```json
{
  "eslint": "latest",
  "eslint-config-next": "latest"
}
```

### Forbidden Dependencies
- `tailwindcss` — Use SCSS Modules
- `styled-components` / `emotion` — Use SCSS Modules
- `typescript` — JSX only
- `stripe` / `razorpay` — WhatsApp is the checkout
- `redux` / `zustand` — Use React state + Supabase real-time
- `axios` — Use native `fetch`

---

## 🎯 Feature Priority

### Must Ship (Priority 1)
1. ✅ Product image upload → Gemini extraction → Supabase save
2. ✅ Public storefront with animated product gallery
3. ✅ WhatsApp checkout (buy + haggle mode)
4. ✅ AI Smart Search
5. ✅ Vibe Tags on product cards
6. ✅ Just Dropped badge (24hr)
7. ✅ Landing page with scroll animations

### Should Ship (Priority 2)
8. Reference Outfit Search
9. AI Bundle Generator
10. Malayalam Mode
11. AI Product Naming (luxury names)

### Nice to Have (Priority 3)
12. AI Color Palette theming
13. Dark Mode toggle (already dark by default)
14. Skeleton loading states
15. Floating WhatsApp FAB
16. Share product link
17. QR Code for WhatsApp

---

## 🧪 Testing Checklist

Before demo:
- [ ] Upload flow works end-to-end
- [ ] Gemini returns valid JSON
- [ ] Products appear on storefront
- [ ] WhatsApp URLs open correctly with pre-filled message
- [ ] Haggle mode generates correct message
- [ ] Smart search returns relevant results
- [ ] Mobile responsive at 375px
- [ ] Animations are smooth (no jank)
- [ ] Error states are handled gracefully
- [ ] Loading states are present

---

## 💡 Coding Patterns

### Component Template
```jsx
'use client';
import { motion } from 'framer-motion';
import styles from './ComponentName.module.scss';

export default function ComponentName({ prop1, prop2 }) {
  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Component content */}
    </motion.div>
  );
}
```

### API Route Template
```javascript
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    if (!body.requiredField) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    // Process
    const result = await processData(body);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Supabase Query Pattern
```javascript
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('store_id', storeId)
  .eq('is_active', true)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Supabase error:', error);
  throw new Error('Failed to fetch products');
}
```

### Gemini Response Parsing
```javascript
function parseGeminiJSON(responseText) {
  // Strip markdown code fences if present
  let cleaned = responseText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}
```

---

## 🗃️ Supabase Schema Reference

### stores
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| owner_id | UUID | FK → auth.users |
| store_name | TEXT | Required |
| whatsapp_number | TEXT | With country code |
| store_slug | TEXT | Unique, URL-friendly |
| logo_url | TEXT | Nullable |
| tagline | TEXT | Default: "Powered by Anya AI" |
| theme | JSONB | {accent, mode} |
| haggle_mode | BOOLEAN | Default: false |
| malayalam_mode | BOOLEAN | Default: false |
| created_at | TIMESTAMPTZ | Auto |

### products
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| store_id | UUID | FK → stores |
| image_url | TEXT | Supabase Storage URL |
| title | TEXT | AI-generated |
| description | TEXT | AI-generated |
| price | NUMERIC(10,2) | AI-estimated |
| category | TEXT | AI-classified |
| vibe_tags | TEXT[] | AI-generated array |
| occasion | TEXT | AI-detected |
| color_palette | JSONB | {primary, secondary, accent} |
| ai_generated | BOOLEAN | Default: true |
| is_active | BOOLEAN | Default: true |
| view_count | INTEGER | Default: 0 |
| created_at | TIMESTAMPTZ | Auto |
| updated_at | TIMESTAMPTZ | Auto |

---

## 📝 Commit Message Format
```
feat: add product upload with Gemini extraction
fix: handle empty vibe_tags array from Gemini
style: update product card hover animation
refactor: extract WhatsApp URL logic to lib
```

---

## ⚡ Performance Rules
1. Use `next/image` with proper `width`, `height`, and `sizes` props
2. Lazy load images below the fold
3. Use `loading="lazy"` on non-critical images
4. Minimize client-side JavaScript — prefer Server Components where possible
5. Use `Suspense` boundaries with skeleton fallbacks
6. Debounce search input (300ms)
7. Use `will-change: transform` only on actively animating elements
8. Prefetch routes with `next/link`
