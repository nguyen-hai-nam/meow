'use client';

import { useEffect, useState } from 'react';

const HEALTH_ENDPOINT = '/api/health';
const HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_CHECK_INTERVAL_MS = 15000;

export default function ServerConnectionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let isChecking = false;

    const checkServer = async () => {
      if (isChecking) return;
      isChecking = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        HEALTH_CHECK_TIMEOUT_MS
      );

      try {
        const response = await fetch(HEALTH_ENDPOINT, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (active) setConnected(response.ok);
      } catch {
        if (active) setConnected(false);
      } finally {
        window.clearTimeout(timeout);
        isChecking = false;
      }
    };

    void checkServer();
    const interval = window.setInterval(checkServer, HEALTH_CHECK_INTERVAL_MS);
    const retryWhenOnline = () => void checkServer();
    const markOffline = () => setConnected(false);
    window.addEventListener('online', retryWhenOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('online', retryWhenOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  if (connected !== false) return null;

  return (
    <div
      className="server-status-banner"
      role="status"
      aria-live="polite"
    >
      <span className="server-status-dot" aria-hidden="true" />
      <span>
        Can’t connect to the server. Please check your connection and come back
        later.
      </span>
    </div>
  );
}
