import Link from 'next/link';
import styles from './StatusPages.module.scss';

export default function NotFound() {
  return (
    <main className={styles.state}>
      <span className={styles.mark}>A</span>
      <span>404 · Collection not found</span>
      <h1>This piece has left the rack.</h1>
      <p>The product may be hidden, sold out, or the link may have changed.</p>
      <div className={styles.actions}>
        <Link href="/dashboard">Open seller studio</Link>
        <Link href="/">Back home</Link>
      </div>
    </main>
  );
}
