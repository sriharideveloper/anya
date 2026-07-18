'use client';

import { useEffect } from 'react';

export default function LenisProvider({ children }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }

  }, []);

  return children;
}
