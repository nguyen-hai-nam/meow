/**
 * Shared install-prompt state and iOS platform detection.
 *
 * Kept outside React so the `beforeinstallprompt` event is captured as soon as
 * the client bundle evaluates, before any component has hydrated.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type IosBrowser =
  | 'safari'
  | 'chrome'
  | 'firefox'
  | 'edge'
  | 'in-app'
  | 'other';

export interface PlatformInfo {
  isIOS: boolean;
  /** True when launched from the home screen (standalone or iOS fullscreen). */
  isStandalone: boolean;
  iosBrowser: IosBrowser;
}

export const EMPTY_PLATFORM: PlatformInfo = {
  isIOS: false,
  isStandalone: false,
  iosBrowser: 'other',
};

export const IOS_BROWSER_LABELS: Record<IosBrowser, string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  firefox: 'Firefox',
  edge: 'Edge',
  'in-app': 'this in-app browser',
  other: 'this browser',
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notify() {
  for (const subscriber of subscribers) subscriber();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredPrompt() {
  return deferredPrompt;
}

export function subscribeToDeferredPrompt(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function detectPlatform(): PlatformInfo {
  if (typeof window === 'undefined') return EMPTY_PLATFORM;

  const ua = navigator.userAgent;
  const iPadOs = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
  const isIOS = /iphone|ipad|ipod/i.test(ua) || iPadOs;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  let iosBrowser: IosBrowser = 'other';

  if (isIOS) {
    if (
      /Instagram|FBAN|FBAV|FB_IAB|Line\/|MicroMessenger|Snapchat|TikTok|Twitter|LinkedInApp/i.test(
        ua
      )
    ) {
      iosBrowser = 'in-app';
    } else if (/CriOS/i.test(ua)) {
      iosBrowser = 'chrome';
    } else if (/FxiOS/i.test(ua)) {
      iosBrowser = 'firefox';
    } else if (/EdgiOS/i.test(ua)) {
      iosBrowser = 'edge';
    } else if (/Safari/i.test(ua)) {
      iosBrowser = 'safari';
    }
  }

  return { isIOS, isStandalone, iosBrowser };
}
