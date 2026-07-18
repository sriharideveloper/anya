---
name: anya-nextjs-scaffold
description: Scaffold the Anya AI Next.js project with App Router, JSX only, SCSS Modules, Framer Motion, and Lenis smooth scrolling. Use when initializing the project or adding new routes.
---

# Anya AI — Next.js Scaffold Skill

## Purpose
Scaffold and maintain the Anya AI Next.js application structure.

## Tech Constraints (NON-NEGOTIABLE)
- **Next.js App Router** — no Pages Router
- **JSX ONLY** — absolutely NO TypeScript (.ts, .tsx files). Use .js and .jsx extensions only
- **SCSS Modules** — every component gets `ComponentName.module.scss`. No CSS-in-JS, no Tailwind
- **Framer Motion** — for all animations, transitions, stagger effects
- **Lenis** — for smooth scrolling on the landing/storefront pages
- **Poppins** — body/normal text font (Google Fonts)
- **Instrument Serif** — heading font, thin weight (Google Fonts)

## Project Structure
```
anya-ai/
├── src/
│   ├── app/
│   │   ├── layout.jsx          # Root layout with fonts, Lenis provider
│   │   ├── page.jsx            # Landing page
│   │   ├── globals.scss        # Global styles, CSS variables, font declarations
│   │   ├── dashboard/
│   │   │   ├── page.jsx        # Authenticated dashboard
│   │   │   └── Dashboard.module.scss
│   │   ├── shop/
│   │   │   └── [storeId]/
│   │   │       ├── page.jsx    # Public storefront
│   │   │       └── Shop.module.scss
│   │   └── api/
│   │       ├── merchandise/
│   │       │   └── route.js    # Gemini AI product extraction
│   │       ├── search/
│   │       │   └── route.js    # AI smart search
│   │       └── auth/
│   │           └── callback/
│   │               └── route.js
│   ├── components/
│   │   ├── ProductCard/
│   │   │   ├── ProductCard.jsx
│   │   │   └── ProductCard.module.scss
│   │   ├── UploadZone/
│   │   │   ├── UploadZone.jsx
│   │   │   └── UploadZone.module.scss
│   │   ├── Navbar/
│   │   ├── SearchBar/
│   │   ├── WhatsAppButton/
│   │   ├── HaggleBot/
│   │   ├── VibeTag/
│   │   ├── BundleRecommender/
│   │   ├── LenisProvider/
│   │   └── SkeletonLoader/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.js        # Browser Supabase client
│   │   │   └── server.js        # Server Supabase client
│   │   ├── gemini.js            # Gemini API wrapper
│   │   └── whatsapp.js          # WhatsApp URL generator
│   ├── hooks/
│   │   ├── useProducts.js
│   │   ├── useAuth.js
│   │   └── useSearch.js
│   └── utils/
│       ├── constants.js
│       └── helpers.js
├── public/
│   └── assets/
├── .env.local                   # API keys (gitignored)
├── next.config.mjs
└── package.json
```

## Initialization Command
```bash
npx -y create-next-app@latest ./ --js --app --src-dir --eslint --no-tailwind --import-alias "@/*"
```

## Required Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr framer-motion @studio-freight/lenis sass @google/generative-ai
```

## Font Setup (layout.jsx)
```jsx
import { Poppins } from 'next/font/google';
import { Instrument_Serif } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});
```

## SCSS Variables Template (globals.scss)
```scss
:root {
  --font-body: var(--font-poppins), 'Poppins', sans-serif;
  --font-heading: var(--font-instrument), 'Instrument Serif', serif;

  // Colors — Premium Dark Theme
  --bg-primary: #0a0a0f;
  --bg-secondary: #111118;
  --bg-card: #16161f;
  --bg-glass: rgba(22, 22, 31, 0.7);
  --text-primary: #f5f5f7;
  --text-secondary: #a1a1aa;
  --accent-primary: #c9a96e;    // Gold
  --accent-secondary: #e8d5b0;  // Light Gold
  --accent-rose: #f43f5e;
  --accent-emerald: #10b981;
  --border-subtle: rgba(201, 169, 110, 0.15);
  --shadow-glow: 0 0 40px rgba(201, 169, 110, 0.1);

  // Spacing
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;

  // Border Radius
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}
```

## Environment Variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=
```

## Rules
1. NEVER create .ts or .tsx files
2. ALWAYS use SCSS Modules — `*.module.scss`
3. ALWAYS use Framer Motion for animations — `motion.div`, `AnimatePresence`, `useInView`
4. All headings use `font-family: var(--font-heading)`
5. All body text uses `font-family: var(--font-body)`
6. Mobile-first responsive design
7. Use CSS Grid and Flexbox, no float layouts
8. Glassmorphism for cards: `backdrop-filter: blur(20px)`
9. Error boundaries on all async operations
10. Loading states with skeleton loaders for all data fetches
