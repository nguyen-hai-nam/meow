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

interface InstallButtonProps {
  /** `pill` for the feed header, `text` for the login footer. */
  variant?: 'pill' | 'text';
}

/**
 * Always-available install entry point. On Chromium it triggers the native
 * install sheet; everywhere else (iOS included) it opens step-by-step help.
 */
export default function InstallButton({ variant = 'pill' }: InstallButtonProps) {
  const [platform, setPlatform] = useState<PlatformInfo>(EMPTY_PLATFORM);
  const [mounted, setMounted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const promptEvent = useSyncExternalStore(
    subscribeToDeferredPrompt,
    getDeferredPrompt,
    () => null
  );

  useEffect(() => {
    setPlatform(detectPlatform());
    setMounted(true);
  }, []);

  const onClick = useCallback(async () => {
    if (!promptEvent) {
      setHelpOpen(true);
      return;
    }

    setBusy(true);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      setHelpOpen(true);
    } finally {
      setBusy(false);
    }
  }, [promptEvent]);

  if (!mounted || platform.isStandalone) return null;

  return (
    <>
      {variant === 'pill' ? (
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="rounded-full border border-pink-200 bg-white/60 px-3 py-1.5
            text-xs font-medium text-warm-pink transition-colors
            hover:bg-pink-50 disabled:opacity-60"
        >
          {busy ? 'Installing…' : 'Install'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="text-xs text-gray-400 underline underline-offset-4
            transition-colors hover:text-gray-600"
        >
          Install this app
        </button>
      )}

      {helpOpen && (
        <InstallHelpDialog
          platform={platform}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  );
}
