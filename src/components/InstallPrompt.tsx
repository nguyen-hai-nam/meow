'use client';

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import InstallHelpDialog from '@/components/InstallHelpDialog';
import {
  EMPTY_PLATFORM,
  detectPlatform,
  getDeferredPrompt,
  subscribeToDeferredPrompt,
  type PlatformInfo,
} from '@/lib/install';

const DISMISS_KEY = 'meow-install-prompt-dismissed';

/**
 * One-time nudge shown above the composer. Dismissing it only hides this
 * banner; the permanent "Install" button in the header stays available.
 */
export default function InstallPrompt() {
  const [platform, setPlatform] = useState<PlatformInfo>(EMPTY_PLATFORM);
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const promptEvent = useSyncExternalStore(
    subscribeToDeferredPrompt,
    getDeferredPrompt,
    () => null
  );

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    if (platform.isStandalone) {
      setVisible(false);
      return;
    }

    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // Storage can be unavailable (private mode); show the prompt anyway.
    }

    if (platform.isIOS || promptEvent) setVisible(true);
  }, [platform, promptEvent]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignore storage failures.
    }
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) {
      setHelpOpen(true);
      return;
    }

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      setHelpOpen(true);
    } finally {
      setVisible(false);
    }
  }, [promptEvent]);

  if (!visible) return null;

  const iosSafari = platform.isIOS && platform.iosBrowser === 'safari';

  return (
    <>
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
                {iosSafari
                  ? 'Tap Share, then “Add to Home Screen”.'
                  : platform.isIOS
                    ? 'Open this page in Safari to install it.'
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

          <button
            type="button"
            onClick={install}
            className="mt-3 w-full rounded-xl gradient-primary py-2.5 text-sm
              font-semibold text-white shadow-md transition-transform
              active:scale-[0.98]"
          >
            {promptEvent ? 'Install' : 'How to install'}
          </button>
        </div>
      </div>

      {helpOpen && (
        <InstallHelpDialog
          platform={platform}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}
