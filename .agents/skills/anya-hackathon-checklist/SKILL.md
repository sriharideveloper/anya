# Anya AI — Hackathon Checklist & Quick Commands

> Your 120-minute lifeline. Follow this and you WILL ship. ✨

---

## ⏱️ Pre-Game (Night Before)

- [ ] Supabase project created
- [ ] Google AI Studio → Get Gemini API key
- [ ] Supabase → Enable Google OAuth provider
- [ ] Supabase → Run the SQL setup script (`supabase-setup.sql`)
- [ ] Copy `.env.example` to `.env.local` and fill in keys
- [ ] 3 beautiful product photos ready (sarees, kurtas, jewellery)
- [ ] WhatsApp number ready (with 91 country code)
- [ ] This repo cloned and `npm install` done

---

## 🚀 Quick Commands

```bash
# Initialize project
npx -y create-next-app@latest ./ --js --app --src-dir --eslint --no-tailwind --import-alias "@/*"

# Install dependencies
npm install @supabase/supabase-js @supabase/ssr framer-motion @studio-freight/lenis sass @google/generative-ai

# Run dev server
npm run dev

# Build (to check for errors)
npm run build
```

---

## 📋 Sprint Checklist

### Phase 1: Scaffold (15 min)
- [ ] `npx create-next-app` with correct flags
- [ ] Install all dependencies
- [ ] Set up `layout.jsx` with fonts (Poppins + Instrument Serif)
- [ ] Create `globals.scss` with CSS variables
- [ ] Create folder structure (components, lib, hooks, utils)
- [ ] Set up Supabase clients (browser + server)
- [ ] Create `middleware.js` for auth protection
- [ ] Create `.env.local` with all keys
- [ ] Verify dev server runs

### Phase 2: AI Upload Flow (30 min)
- [ ] Create `UploadZone` component with drag & drop
- [ ] Create `/api/merchandise/route.js`
- [ ] Create `lib/gemini.js` with error-proof parser
- [ ] Create `/dashboard/page.jsx`
- [ ] Wire up: upload → Gemini → save to Supabase
- [ ] Test with real product image
- [ ] Verify data appears in Supabase dashboard

### Phase 3: Storefront (35 min)
- [ ] Create `ProductCard` component (glassmorphism, hover effects)
- [ ] Create `VibeTag` component
- [ ] Create `/shop/[storeId]/page.jsx`
- [ ] Implement Framer Motion stagger animations
- [ ] Add "Just Dropped" badge logic
- [ ] Add skeleton loading states
- [ ] Mobile responsive layout
- [ ] Test at 375px width

### Phase 4: WhatsApp Engine (25 min)
- [ ] Create `lib/whatsapp.js` (buy + haggle modes)
- [ ] Create `WhatsAppButton` component
- [ ] Implement Haggle Bot mode toggle
- [ ] Create floating WhatsApp FAB
- [ ] Test WhatsApp URLs on actual phone
- [ ] Verify URL encoding works with special characters

### Phase 5: Landing Page (15 min)
- [ ] Hero section with animated text reveal
- [ ] How It Works section (3 steps)
- [ ] Feature cards (bento grid)
- [ ] CTA section
- [ ] Lenis smooth scrolling
- [ ] Scroll-triggered animations

### Phase 6: Polish & Demo Prep (10 min)
- [ ] Seed 3 beautiful products
- [ ] Test full flow: upload → storefront → WhatsApp
- [ ] Smart search demo: "blue saree under 3000 for Onam"
- [ ] Haggle mode demo
- [ ] Screenshot everything
- [ ] Practice 2-minute pitch

---

## 🆘 Emergency Fixes

### "Gemini returns invalid JSON"
```javascript
// Add responseMimeType to force JSON output
generationConfig: {
  responseMimeType: 'application/json',
}
```

### "Supabase RLS blocks queries"
```sql
-- Check if RLS is the issue by temporarily disabling (DEV ONLY!)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
-- Debug, then re-enable and fix policies
```

### "Images not uploading"
```javascript
// Check bucket exists and is public
// Check storage policies allow authenticated uploads
// Check file size < 5MB
```

### "WhatsApp URL not working"
```javascript
// Must use https://wa.me/ not whatsapp://
// Phone must include country code (91)
// Message must be encodeURIComponent'd
```

### "Framer Motion not working in Server Component"
```javascript
// Add 'use client'; at the top of the file
// Framer Motion only works in Client Components
```

### "SCSS Module not applying"
```javascript
// Import as: import styles from './Component.module.scss';
// Use as: className={styles.myClass}
// NOT className="myClass"
```

### "Auth redirect loop"
```javascript
// Check middleware.js matcher patterns
// Check callback URL matches Supabase OAuth settings
// Check NEXT_PUBLIC_SUPABASE_URL is correct
```
