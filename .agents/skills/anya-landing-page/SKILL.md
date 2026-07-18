---
name: anya-landing-page
description: Build the Anya AI landing page with scroll-based animations, Lenis smooth scrolling, hero section, feature showcase, and CTA. Peak aesthetics with Instrument Serif headings and Poppins body text.
---

# Anya AI — Landing Page Skill

## Purpose
Create a jaw-dropping landing page that makes judges say WOW.

## Page Structure

### Section 1: Hero
- Full viewport height
- Animated gradient background with noise texture overlay
- Large Instrument Serif headline: "Your Boutique. AI-Powered."
- Subtitle in Poppins: "Launch your storefront from a single photo."
- CTA button: "Get Started" with glow animation
- Floating product card mockups with parallax effect
- Scroll indicator at bottom

### Section 2: How It Works
- 3-step visual flow with scroll-triggered animations
- Step 1: Upload → animated upload icon
- Step 2: AI Magic → animated sparkles
- Step 3: WhatsApp → animated phone
- Each step reveals on scroll using `useInView`
- Connected by animated dotted line

### Section 3: Feature Showcase
- Bento grid layout
- Cards for: AI Merchandising, Vibe Tags, Smart Search, Haggle Bot, Malayalam Mode, Bundle Generator
- Each card has glassmorphism background
- Stagger animation on scroll
- Interactive hover effects

### Section 4: Vibe Tags Demo
- Live demo showing example vibe tags floating/orbiting
- Tags like: Kalyanam Ready, Onam Special, Temple Collection, Minimal Luxury
- Animated with Framer Motion `layoutId` transitions

### Section 5: CTA / Footer
- "Ready to launch your storefront?" in Instrument Serif
- Large CTA button
- Social links
- "Made with ❤️ in Kerala" footer

## Animation Guidelines

### Scroll Reveal Pattern
```jsx
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

function ScrollReveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ 
        duration: 0.8, 
        delay,
        ease: [0.22, 1, 0.36, 1] 
      }}
    >
      {children}
    </motion.div>
  );
}
```

### Hero Text Reveal
```jsx
const headingChars = "Your Boutique. AI-Powered.".split('');

// Animate each character with stagger
<motion.h1 className={styles.heroHeading}>
  {headingChars.map((char, i) => (
    <motion.span
      key={i}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        delay: i * 0.03,
        ease: [0.22, 1, 0.36, 1]
      }}
    >
      {char === ' ' ? '\u00A0' : char}
    </motion.span>
  ))}
</motion.h1>
```

### Background Gradient
```scss
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: radial-gradient(
    ellipse at 30% 50%,
    rgba(201, 169, 110, 0.08) 0%,
    transparent 60%
  ),
  radial-gradient(
    ellipse at 70% 80%,
    rgba(244, 63, 94, 0.05) 0%,
    transparent 50%
  ),
  var(--bg-primary);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/assets/noise.svg');
    opacity: 0.03;
    pointer-events: none;
  }
}
```

### Floating Cards Parallax
```jsx
import { motion, useScroll, useTransform } from 'framer-motion';

function FloatingCard({ style, delay }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -100]);

  return (
    <motion.div
      className={styles.floatingCard}
      style={{ ...style, y }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
    />
  );
}
```

## Performance
1. Use `next/image` for all images with proper sizing
2. Lazy load sections below the fold
3. Use `will-change: transform` sparingly on animated elements
4. Debounce scroll events
5. Use `useInView` with `once: true` to avoid re-triggering

## Responsive
- Hero heading: 4rem desktop → 2.5rem mobile
- Bento grid: 3 columns → 2 columns tablet → 1 column mobile
- Floating cards hidden on mobile
- Touch-friendly tap targets (min 44px)
