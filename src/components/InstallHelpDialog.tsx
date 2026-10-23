'use client';

import { useEffect, useRef, useState } from 'react';
import {
  IOS_BROWSER_LABELS,
  type PlatformInfo,
} from '@/lib/install';

interface InstallHelpDialogProps {
  platform: PlatformInfo;
  onClose: () => void;
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center
          rounded-full bg-pink-50 text-xs font-bold text-warm-pink"
      >
        {number}
      </span>
      <span className="text-sm leading-relaxed text-gray-600">{children}</span>
    </li>
  );
}

export default function InstallHelpDialog({
  platform,
  onClose,
}: InstallHelpDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL is visible above anyway.
    }
  };

  const needsSafari = platform.isIOS && platform.iosBrowser !== 'safari';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4
        sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-dialog-title"
        className="w-full max-w-sm animate-slide-up rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="install-dialog-title"
              className="text-lg font-bold text-gray-800"
            >
              Install Meow Moments
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {platform.isIOS
                ? 'Add it to your Home Screen for a full-screen app.'
                : 'Install it for a full-screen, app-like experience.'}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close install instructions"
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-gray-400
              transition-colors hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {platform.isIOS ? (
          <>
            {needsSafari && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">
                  Open this page in Safari
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  On iPhone and iPad, only Safari can add web apps to the Home
                  Screen. {IOS_BROWSER_LABELS[platform.iosBrowser]} cannot do
                  it.
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className="mt-2 text-xs font-semibold text-amber-800 underline
                    underline-offset-2"
                >
                  {copied ? 'Link copied' : `Copy ${origin || 'this link'}`}
                </button>
              </div>
            )}

            <ol className="mt-5 space-y-4">
              <Step number={1}>
                Open this page in <strong>Safari</strong>.
              </Step>
              <Step number={2}>
                Tap the <strong>Share</strong> button (the square with an arrow
                pointing up) in the toolbar.
              </Step>
              <Step number={3}>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </Step>
              <Step number={4}>
                Tap <strong>Add</strong> in the top corner.
              </Step>
            </ol>

            <p className="mt-4 text-xs leading-relaxed text-gray-400">
              Private Browsing tabs cannot install web apps. If you added an
              older version before, delete that icon and add it again now.
            </p>
          </>
        ) : (
          <ol className="mt-5 space-y-4">
            <Step number={1}>
              Open your browser menu and choose{' '}
              <strong>Install app</strong> or{' '}
              <strong>Add to Home screen</strong>.
            </Step>
            <Step number={2}>
              On desktop Chrome or Edge, click the install icon at the right end
              of the address bar.
            </Step>
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl gradient-primary py-2.5 text-sm
            font-semibold text-white shadow-md transition-transform
            active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
