import styles from './StatusPages.module.scss';

export default function Loading() {
  return (
    <main className={styles.state} aria-label="Loading Anya AI">
      <div className={styles.loader} aria-hidden="true">
        <div className={styles.loaderBar} />
        <div className={styles.loaderTitle} />
        <div className={styles.loaderLine} />
        <div className={styles.loaderLine} />
      </div>
    </main>
  );
}
