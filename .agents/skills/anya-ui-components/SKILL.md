# Anya AI — Error Boundary & Loading Components

> Ready-to-use error boundary, skeleton loaders, and toast notifications.
> Drop these into your project as-is.

---

## Error Boundary Component

```jsx
// components/ErrorBoundary/ErrorBoundary.jsx
'use client';
import { Component } from 'react';
import { motion } from 'framer-motion';
import styles from './ErrorBoundary.module.scss';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <motion.div
            className={styles.errorCard}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <span className={styles.emoji}>😵</span>
            <h2>Oops! Something went wrong</h2>
            <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className={styles.retryBtn}
            >
              Try Again
            </button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

```scss
// components/ErrorBoundary/ErrorBoundary.module.scss
.errorContainer {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: var(--space-xl);
}

.errorCard {
  text-align: center;
  padding: var(--space-3xl);
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  max-width: 400px;

  .emoji {
    font-size: 3rem;
    display: block;
    margin-bottom: var(--space-md);
  }

  h2 {
    font-family: var(--font-heading);
    color: var(--text-primary);
    margin-bottom: var(--space-sm);
  }

  p {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: var(--space-xl);
  }
}

.retryBtn {
  padding: 10px 24px;
  background: var(--accent-primary);
  color: var(--bg-primary);
  border: none;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--accent-secondary);
    transform: translateY(-2px);
  }
}
```

---

## Skeleton Loader Component

```jsx
// components/SkeletonLoader/SkeletonLoader.jsx
import styles from './SkeletonLoader.module.scss';

export function ProductCardSkeleton() {
  return (
    <div className={styles.cardSkeleton}>
      <div className={`${styles.skeleton} ${styles.image}`} />
      <div className={styles.content}>
        <div className={`${styles.skeleton} ${styles.title}`} />
        <div className={`${styles.skeleton} ${styles.description}`} />
        <div className={styles.tags}>
          <div className={`${styles.skeleton} ${styles.tag}`} />
          <div className={`${styles.skeleton} ${styles.tag}`} />
          <div className={`${styles.skeleton} ${styles.tag}`} />
        </div>
        <div className={styles.bottom}>
          <div className={`${styles.skeleton} ${styles.price}`} />
          <div className={`${styles.skeleton} ${styles.button}`} />
        </div>
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className={styles.gridSkeleton}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

```scss
// components/SkeletonLoader/SkeletonLoader.module.scss
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-card) 25%,
    rgba(201, 169, 110, 0.05) 50%,
    var(--bg-card) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

.cardSkeleton {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.image {
  aspect-ratio: 3/4;
  width: 100%;
}

.content {
  padding: var(--space-md);
}

.title {
  height: 20px;
  width: 70%;
  margin-bottom: var(--space-sm);
}

.description {
  height: 14px;
  width: 90%;
  margin-bottom: var(--space-md);
}

.tags {
  display: flex;
  gap: 6px;
  margin-bottom: var(--space-md);
}

.tag {
  height: 24px;
  width: 80px;
  border-radius: var(--radius-full);
}

.bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price {
  height: 24px;
  width: 80px;
}

.button {
  height: 36px;
  width: 140px;
  border-radius: var(--radius-full);
}

.gridSkeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-xl);
}
```

---

## Toast Notification Component

```jsx
// components/Toast/Toast.jsx
'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Toast.module.scss';

const ICONS = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  loading: '⏳',
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  useEffect(() => {
    if (type !== 'loading' && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, type, onClose]);

  return (
    <motion.div
      className={`${styles.toast} ${styles[type]}`}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={styles.icon}>{ICONS[type]}</span>
      <span className={styles.message}>{message}</span>
      {type !== 'loading' && (
        <button className={styles.close} onClick={onClose}>×</button>
      )}
    </motion.div>
  );
}

// Toast Container — wrap your app with this
export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className={styles.container}>
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

```scss
// components/Toast/Toast.module.scss
.container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 0.875rem;
  min-width: 280px;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  &.success { border-color: var(--accent-emerald); }
  &.error { border-color: var(--accent-rose); }
  &.info { border-color: var(--accent-primary); }
  &.loading { border-color: var(--accent-primary); }
}

.icon { font-size: 1.1rem; }
.message { flex: 1; }

.close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;

  &:hover { color: var(--text-primary); }
}
```

---

## useToast Hook

```javascript
// hooks/useToast.js
'use client';
import { useState, useCallback } from 'react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((msg) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg) => addToast(msg, 'error', 5000), [addToast]);
  const info = useCallback((msg) => addToast(msg, 'info'), [addToast]);
  const loading = useCallback((msg) => addToast(msg, 'loading', 0), [addToast]);

  return { toasts, addToast, removeToast, success, error, info, loading };
}
```
