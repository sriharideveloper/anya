'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import styles from './page.module.scss';

const flow = [
  ['01', 'Drop a photo', 'Upload any boutique product image.'],
  ['02', 'Anya styles it', 'AI writes the listing, price and vibe tags.'],
  ['03', 'WhatsApp closes it', 'Customers order in a chat they already trust.'],
];

const features = [
  ['Nano Banana visuals', 'Turn a flat saree photo into up to five model-worn campaign looks.'],
  ['AI merchandising', 'Names, descriptions, pricing, categories and vibe tags in one click.'],
  ['Living storefront', 'Every seller gets a responsive collection that grows with each new product.'],
  ['WhatsApp checkout', 'Buyers go from discovery to a ready-to-send order without learning a new flow.'],
];

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.brand}>Anya<span>.</span></Link>
        <Link href="/dashboard" className={styles.navCta}>Open studio</Link>
      </nav>

      <motion.section
        className={styles.hero}
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className={styles.kicker}><i /> Your storefront is one photo away</span>
        <h1>From camera roll<br />to <em>sold.</em></h1>
        <p>
          Anya turns a product photo into a polished storefront and sends every
          serious buyer straight to WhatsApp.
        </p>
        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.primary}>Build my storefront <span>↗</span></Link>
          <a href="#how-it-works" className={styles.secondary}>See how it works</a>
        </div>
      </motion.section>

      <motion.section
        className={styles.showcase}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.visualStage}>
          <span className={styles.aiBadge}>✦ Nano Banana visual</span>
          <div className={styles.silhouette}><i /><b /></div>
          <div className={styles.palette}><i /><i /><i /></div>
        </div>
        <div className={styles.listingCard}>
          <span className={styles.label}>Generated storefront listing</span>
          <h2>Kasavu<br />Afterglow</h2>
          <p>Classic Kerala gold meets a clean contemporary drape—made for celebrations that deserve to linger.</p>
          <div className={styles.miniTags}><span>Onam Edit</span><span>Quiet Luxury</span><span>Handloom</span></div>
          <strong>₹4,899</strong>
          <Link href="/dashboard">Build this storefront <span>↗</span></Link>
        </div>
      </motion.section>

      <section className={styles.flow} id="how-it-works">
        <div className={styles.flowHeading}>
          <span className={styles.label}>One clean loop</span>
          <h2>Less setup.<br />More selling.</h2>
        </div>
        <div className={styles.steps}>
          {flow.map(([number, title, copy], index) => (
            <motion.article
              key={number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.featureHeading}>
          <span className={styles.label}>Everything between upload and order</span>
          <h2>A boutique engine.<br /><em>Not another store builder.</em></h2>
        </div>
        <div className={styles.featureGrid}>
          {features.map(([title, copy], index) => (
            <motion.article
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <span className={styles.label}>Your next drop can be live tonight</span>
        <h2>Upload it.<br /><em>Let Anya sell it.</em></h2>
        <Link href="/dashboard">Create my storefront <span>↗</span></Link>
      </section>

      <footer className={styles.footer}><Link href="/" className={styles.brand}>Anya<span>.</span></Link><p>AI storefronts built for WhatsApp commerce.</p><span>Codex Nightline · Kochi</span></footer>
    </main>
  );
}
