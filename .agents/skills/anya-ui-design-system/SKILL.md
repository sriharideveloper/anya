---
name: anya-ui-design-system
description: Design system and UI guidelines for Anya AI including typography, colors, animations, glassmorphism cards, responsive design, and premium aesthetics.
---

# Anya AI — UI Design System Skill

## Purpose
Enforce premium, peak aesthetics across all Anya AI components.

## Design Philosophy
- **Dark luxury** — deep blacks with gold accents
- **Glassmorphism** — frosted glass cards
- **Micro-animations** — everything breathes
- **Kerala-meets-luxury** — traditional warmth with modern premium feel

## Typography

| Element | Font | Weight | Size (Desktop) | Size (Mobile) |
|---------|------|--------|----------------|---------------|
| H1 | Instrument Serif | 400 (thin) | 4rem | 2.5rem |
| H2 | Instrument Serif | 400 | 2.5rem | 1.75rem |
| H3 | Instrument Serif | 400 | 1.75rem | 1.25rem |
| Body | Poppins | 400 | 1rem | 0.875rem |
| Caption | Poppins | 300 | 0.875rem | 0.75rem |
| Button | Poppins | 600 | 0.875rem | 0.8rem |
| Tag | Poppins | 500 | 0.75rem | 0.65rem |

## Color System

### Primary Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0a0a0f` | Page background |
| `--bg-secondary` | `#111118` | Section background |
| `--bg-card` | `#16161f` | Card background |
| `--bg-glass` | `rgba(22,22,31,0.7)` | Glass cards |
| `--text-primary` | `#f5f5f7` | Main text |
| `--text-secondary` | `#a1a1aa` | Muted text |
| `--accent-primary` | `#c9a96e` | Gold accent |
| `--accent-secondary` | `#e8d5b0` | Light gold |
| `--accent-rose` | `#f43f5e` | Badges, alerts |
| `--accent-emerald` | `#10b981` | Success, price |

## Component Patterns

### Product Card
```scss
.productCard {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-glow);
    border-color: var(--accent-primary);
  }

  .imageContainer {
    position: relative;
    aspect-ratio: 3/4;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s ease;
    }

    &:hover img {
      transform: scale(1.08);
    }
  }

  .badge {
    position: absolute;
    top: 12px;
    left: 12px;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;

    &.justDropped {
      background: linear-gradient(135deg, #f43f5e, #ec4899);
      color: white;
    }

    &.trending {
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      color: white;
    }
  }

  .vibeTagsContainer {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 var(--space-md);
  }
}
```

### Vibe Tag
```scss
.vibeTag {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  background: rgba(201, 169, 110, 0.1);
  border: 1px solid rgba(201, 169, 110, 0.2);
  color: var(--accent-secondary);
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(201, 169, 110, 0.2);
    border-color: var(--accent-primary);
  }
}
```

### Upload Zone
```scss
.uploadZone {
  border: 2px dashed var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-3xl);
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--bg-card);

  &:hover, &.dragActive {
    border-color: var(--accent-primary);
    background: rgba(201, 169, 110, 0.05);
    box-shadow: var(--shadow-glow);
  }

  &.uploading {
    pointer-events: none;
    opacity: 0.7;
  }
}
```

## Framer Motion Presets
```javascript
export const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
};

export const slideInLeft = {
  initial: { opacity: 0, x: -40 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
};

export const heroReveal = {
  initial: { opacity: 0, y: 60, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 1, ease: [0.22, 1, 0.36, 1] }
};
```

## Responsive Breakpoints
```scss
$mobile: 480px;
$tablet: 768px;
$desktop: 1024px;
$wide: 1440px;

@mixin mobile { @media (max-width: #{$mobile}) { @content; } }
@mixin tablet { @media (max-width: #{$tablet}) { @content; } }
@mixin desktop { @media (min-width: #{$desktop}) { @content; } }
@mixin wide { @media (min-width: #{$wide}) { @content; } }
```

## Lenis Setup
```jsx
'use client';
import { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';

export default function LenisProvider({ children }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return children;
}
```

## Rules
1. EVERY interactive element must have hover and active states
2. EVERY card must use glassmorphism
3. EVERY page transition must use Framer Motion
4. EVERY image must lazy load with blur placeholder
5. EVERY loading state must use skeleton loaders (animated shimmer)
6. NO plain white backgrounds — always dark theme
7. NO default browser fonts — always Poppins or Instrument Serif
8. Mobile responsive is NOT optional — test at 375px width
9. Scroll-based animations using `useInView` from Framer Motion
10. All animations use the custom easing `[0.22, 1, 0.36, 1]`
