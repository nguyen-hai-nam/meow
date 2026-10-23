'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 *
 * In development the worker would cache Turbopack chunks and interfere with
 * hot reloading, so registration is skipped there.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // In development the worker would cache Turbopack chunks and interfere
    // with hot reloading, so make sure none is left over from a production
    // run on the same origin.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch((error) => {
          console.error('Could not unregister service worker:', error);
        });
      return;
    }

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .catch((error) => {
          console.error('Service worker registration failed:', error);
        });
    };

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
