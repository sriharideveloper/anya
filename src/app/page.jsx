'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import styles from './page.module.scss';

const flow = [
  ['01', 'Drop a photo', 'Upload any boutique product image.'],
  ['02', 'Anya styles it', 'AI writes the listing, price and vibe tags.'],
  ['03', 'WhatsApp closes it', 'Customers order in a chat they already trust.'],
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
    </main>
  );
}
