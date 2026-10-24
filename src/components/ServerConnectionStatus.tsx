'use client';

import { useEffect, useState } from 'react';

export default function ServerConnectionStatus() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    let checking = false;

    const checkServer = async () => {
      if (checking) return;
      checking = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch('/api/health', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (active) setConnected(response.ok);
      } catch {
        if (active) setConnected(false);
      } finally {
        window.clearTimeout(timeout);
        checking = false;
      }
    };

    void checkServer();
    const interval = window.setInterval(checkServer, 15000);
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
