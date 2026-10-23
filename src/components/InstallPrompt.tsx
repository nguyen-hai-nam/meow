'use client';

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'meow-install-prompt-dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iPadOs = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/i.test(ua) || iPadOs;
}

/**
 * Small "add to home screen" prompt.
 *
 * Android/Chrome fire `beforeinstallprompt`, so we can trigger the native
 * install sheet. iOS Safari has no such API, so there we show the manual
 * Share -> Add to Home Screen hint instead.
 */
export default function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // Storage can be unavailable (private mode); show the prompt anyway.
    }

    const iosDevice = isIosDevice();
    setIos(iosDevice);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setVisible(false);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // iOS never fires `beforeinstallprompt`; show the manual hint instead.
    if (iosDevice) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore storage failures.
    }
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      setVisible(false);
      setPromptEvent(null);
    }
  }, [promptEvent]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-30 animate-slide-up">
      <div className="glass rounded-2xl border border-pink-100 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800">
              Add Meow to your home screen
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              {ios
                ? 'Tap Share, then “Add to Home Screen”.'
                : 'Full screen, one tap away — and it opens faster.'}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-gray-400
              transition-colors hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {!ios && promptEvent && (
          <button
            type="button"
            onClick={install}
            className="mt-3 w-full rounded-xl gradient-primary py-2.5 text-sm
              font-semibold text-white shadow-md transition-transform
              active:scale-[0.98]"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
