'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import styles from './StatusPages.module.scss';

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    console.error('Anya page error:', error);
  }, [error]);

  return (
    <main className={styles.state}>
      <span className={styles.mark}>A</span>
      <span>Something slipped</span>
      <h1>The storefront needs one more drape.</h1>
      <p>Your work is safe. Retry this screen, or return home and continue from the seller studio.</p>
      <div className={styles.actions}>
        <button onClick={reset}>Try again</button>
        <Link href="/">Back home</Link>
      </div>
    </main>
  );
}
