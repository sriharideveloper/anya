# Anya AI

### One product photo in. A polished, WhatsApp-first storefront out.

Anya AI is a working storefront studio for independent sellers. Upload one to three reference photos, let Gemini turn any product into ready-to-edit merchandise, optionally generate up to five product-aware campaign visuals, and publish it to a responsive storefront. Buyers can open a rich WhatsApp order or bargain message without carts, payment gateways, or a new account.

**The core demo:** product references -> AI merchandise -> campaign gallery -> live product page -> WhatsApp order.

| Project | Details |
|---|---|
| **Builder** | Srihari Muralikrishnan |
| **Event** | [Codex Nightline 2026](https://www.codexnightline.in/) |
| **Track** | Local Business & Creator Tools |
| **Stack** | Next.js App Router, React, Supabase, Gemini, SCSS Modules, Framer Motion |
| **Checkout** | WhatsApp buy and haggle flows |

## Demo flow

1. Open `/dashboard`, create an email/password account, and name the storefront.
2. Upload a JPEG, PNG, or WebP product photo (up to 5 MB).
3. Generate the title, description, price, category, and vibe tags with Gemini.
4. Verify the listing, accept or replace the suggested price, add stock and options, then optionally generate up to five product-aware visuals.
5. Pick the original or generated visual and publish. Repeat to build a multi-product collection.
6. Open the public storefront, search the collection, share a product, then try **Buy on WhatsApp** and **Bargain**.

## What is shipped

- **Seller access:** Supabase email/password authentication, session handling, and multiple owner-controlled storefronts per account.
- **Multi-product seller studio:** publish repeated drops and manage the full catalogue from one screen.
- **Grounded Gemini merchandising:** free-form product classification, editable attributes and tags, and an explicitly optional price suggestion. Seller corrections always win; AI never invents stock, SKUs, sizes, materials, or components.
- **Product-aware visual studio:** generate one to five optional campaign visuals with Gemini image generation, keep every successful result if a batch is partial, and choose the public cover and gallery before publishing.
- **Public commerce pages:** a URL-filtered, searchable and sortable store at `/shop?store=<slug>` plus a metadata-rich page for every product at `/product/<id>`.
- **Sharing:** native share and copy-link fallbacks on cards, plus WhatsApp, Instagram, Facebook, X, Pinterest, and LinkedIn actions on product pages.
- **WhatsApp conversion:** distinct, pre-filled buy and bargain messages carrying product, price, category, occasion, vibe, selected options, and the product URL.
- **Premium inventory controls:** owner editing, price and compare-at pricing, discount treatment, stock counts, limited-stock states, sold-out protection, hide/show, and permanent deletion.
- **Protected AI pipeline:** authenticated generation routes, durable seller quotas, request bounds, idempotency, one retry, safe visual prompts, and private reference storage.
- **Kerala editorial UI:** responsive dark-ink, ivory, and vermilion art direction with Instrument Serif, Poppins, motion, strong focus states, and layouts tuned from phones to wide screens.
- **Protected data:** Row Level Security, owner checks on mutations, server-only service credentials, validated uploads, and a public `product-images` bucket.

## Architecture

```text
Browser
  |-- /                         landing page
  |-- /dashboard                auth, store setup, AI studio, inventory
  |-- /shop?store=<slug>        public multi-product storefront
  `-- /product/<id>             shareable product detail and checkout
          |
          |-- /api/merchandise  Gemini structured merchandise
          |-- /api/visuals      Nano Banana model imagery
          `-- /api/products     authenticated publish/edit/delete
                    |
                    `-- Supabase Auth + Postgres + Storage + RLS
```

The app uses the Next.js 15 App Router and JSX, SCSS Modules for component styling, Framer Motion for interaction, Supabase for identity and commerce data, and Gemini server routes for generation. Public reads stay behind Supabase RLS; product writes verify the signed-in user and storefront ownership before using the server-side service role.

## Run locally

You need Node.js 20+, npm, a Supabase project, and a Google Gemini API key.

```bash
npm install
cp .env.example .env.local
```

PowerShell equivalent for the copy step:

```powershell
Copy-Item .env.example .env.local
```

Fill `.env.local`, initialize Supabase as described below, then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production check, run `npm run build` followed by `npm start`.

## Initialize Supabase

In a new Supabase project:

1. Keep the Email auth provider enabled. Set the Auth Site URL to `http://localhost:3000` while developing and add the deployed `/dashboard` redirect URL for production.
2. Open the SQL Editor and run [`.agents/skills/anya-supabase-setup/supabase-setup.sql`](./.agents/skills/anya-supabase-setup/supabase-setup.sql) in full for a new database.
3. Run the single forward migration [`.agents/skills/anya-supabase-setup/product-generalization.sql`](./.agents/skills/anya-supabase-setup/product-generalization.sql) in full. Existing databases only need this step; it is transactional, preserves current products, and is safe to rerun.

The migration adds flexible product attributes, variants, public galleries, private references, AI job metadata, seller quotas, public-safe views, indexes, triggers, and tightened RLS/storage policies. Existing product images are backfilled into the new media model.

## Environment variables

Use the same six keys locally and in **Vercel -> Project Settings -> Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_WHATSAPP_NUMBER=919876543210
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
```

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server secrets: never prefix them with `NEXT_PUBLIC_` and never commit `.env.local`. Redeploy after changing Vercel environment values. Also add the Vercel domain to Supabase Auth redirect URLs.

## Build status

- [x] Responsive landing page and Kerala editorial design system
- [x] Supabase authentication, schema, storage, and RLS
- [x] Multi-store onboarding and multi-product seller studio
- [x] Grounded Gemini merchandise generation with seller-authoritative editing
- [x] One-to-three references and one-to-five product-aware visual generation
- [x] Cover selection, public galleries, flexible variants, and private AI metadata
- [x] Public storefront search and shareable product pages
- [x] Rich WhatsApp buy and bargain checkout
- [x] Stock, discounts, sold-out states, edit, hide, and delete controls
- [x] Social sharing, metadata, sitemap, robots, and Open Graph image
- [x] Mobile, tablet, and desktop responsive treatment

## Codex process and event proof

Anya AI was built as a sequence of working vertical slices during Codex Nightline: scaffold, end-to-end storefront, authenticated studio, AI generation, publishing hardening, and premium commerce controls. The repository keeps the working constraints in [`.agents/AGENTS.md`](./.agents/AGENTS.md), focused build playbooks in [`.agents/skills/`](./.agents/skills/), and the sprint trail in Git history.

The photograph below documents the builder's presence at Codex Nightline 2026.

<p align="center">
  <img src="./proof.jpg" alt="Srihari Muralikrishnan at Codex Nightline 2026" width="420" />
</p>

### Submission declaration

I, **Srihari Muralikrishnan**, submit **Anya AI** as my project for Codex Nightline 2026. This repository and the participation photograph above are provided as supporting submission material.

---

Built for one train, one night, and one focused sprint in Kochi.
