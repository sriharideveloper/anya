# Anya AI

### Turn one product photo into a beautiful, WhatsApp-first storefront.

Anya AI is an AI storefront generator for local sellers and creators. A seller uploads a product image, Gemini converts it into structured merchandise, and Anya publishes it to a premium mobile storefront where customers can buy—or haggle—through WhatsApp.

> **Build status:** Pre-coding foundation complete. MVP implementation begins during the official Codex Nightline sprint.

| Project | Details |
|---|---|
| **Builder** | Srihari Muralikrishnan |
| **Event** | [Codex Nightline 2026](https://www.codexnightline.in/) |
| **Track** | Local Business & Creator Tools |
| **Core stack** | Next.js App Router, Supabase, Gemini, SCSS Modules |
| **Core journey** | Product photo → AI merchandising → Storefront → WhatsApp |

## Build Status

- [x] Pre-coding architecture prepared
- [ ] Next.js application scaffolded
- [ ] Supabase connected
- [ ] Product image upload implemented
- [ ] Gemini merchandise generation implemented
- [ ] Public storefront implemented
- [ ] WhatsApp buy flow implemented
- [ ] Natural-language product search
- [ ] Malayalam storefront mode
- [ ] Final deployment and demo recording

## The Idea

Small sellers often have product photos and a WhatsApp number, but no time or technical capacity to build and maintain an online store. Anya AI reduces that setup to a simple flow:

1. Upload a product photograph.
2. Let Gemini generate the title, description, category, price estimate, vibe tags, and occasion.
3. Review and save the product to Supabase.
4. Publish it in a shareable storefront.
5. Send customers to WhatsApp with a ready-made buy or haggle message.

There is no cart or payment-gateway complexity. WhatsApp is the checkout.

## Planned MVP

- AI-assisted product merchandising from an image
- Animated public storefront and product gallery
- WhatsApp buy and haggle flows
- Natural-language smart search
- AI-generated vibe tags
- “Just Dropped” product badges
- Responsive landing page and seller dashboard

## Foundation Included

This repository is intentionally in its pre-coding phase. The implementation rules and reusable build knowledge are prepared before the application scaffold is generated.

```text
.
|-- .agents/
|   |-- AGENTS.md                 # Architecture, design, security, and coding rules
|   |-- skills.json               # Registered project skills
|   `-- skills/                   # 11 reusable Anya implementation skills
|-- .env.example                  # Required service configuration
|-- proof.jpg                     # Event participation proof
`-- README.md
```

The project rules enforce JSX-only Next.js App Router code, SCSS Modules, a mobile-first dark interface, secure server-side secrets, Supabase RLS, and resilient Gemini response parsing.

## Before Coding

- [x] Product concept and MVP defined
- [x] Architecture and design constraints documented
- [x] Environment variable template prepared
- [x] Supabase schema and RLS setup prepared
- [x] Gemini, WhatsApp, UI, scaffold, and demo skills registered
- [x] Hackathon build sequence documented
- [ ] Create the Next.js application scaffold
- [ ] Add local environment credentials
- [ ] Provision Supabase and run the setup SQL
- [ ] Build and test the end-to-end MVP

When development begins, copy the environment template and fill in private values locally:

```bash
cp .env.example .env.local
```

Never commit `.env.local` or any service-role/API key.

## Product Principles

- **Fast for sellers:** an image should become a sellable listing in moments.
- **Familiar for buyers:** discovery happens on the storefront; conversion happens in WhatsApp.
- **Local by design:** support conversational commerce and Malayalam-friendly experiences.
- **Focused for the sprint:** ship the core upload-to-WhatsApp journey before optional features.

## Submission Proof

The photograph below documents the builder’s presence at Codex Nightline 2026.

<p align="center">
  <img src="./proof.jpg" alt="Srihari Muralikrishnan at Codex Nightline 2026" width="420" />
</p>

## Submission Declaration

I, **Srihari Muralikrishnan**, submit **Anya AI** as my project for Codex Nightline 2026. This repository and the participation photograph above are provided as supporting submission material.

---

Built for one train, one night, and one focused AI sprint in Kochi.
