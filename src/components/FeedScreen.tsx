'use client';

import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/CameraCapture';
import VoiceRecorder from '@/components/VoiceRecorder';
import MomentStack from '@/components/MomentStack';
import InstallPrompt from '@/components/InstallPrompt';
import InstallButton from '@/components/InstallButton';
import type { PublicUser } from '@/lib/users';
import type { Moment } from '@/lib/types';

interface FeedScreenProps {
  user: PublicUser;
  users: PublicUser[];
  initialMoments: Moment[];
}

const LEGACY_CLEARED_KEY = 'meow:cleared-moments';
const MAX_LEGACY_CLEARED_MOMENTS = 50;
const MOMENT_POLL_INTERVAL_MS = 5000;

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mpeg': 'mp3',
};

function audioExtension(mimeType: string): string {
  return AUDIO_EXTENSIONS[mimeType.split(';')[0].trim().toLowerCase()] ?? 'webm';
}

export default function FeedScreen({
  user,
  users,
  initialMoments,
}: FeedScreenProps) {
  const router = useRouter();
  const [moments, setMoments] = useState<Moment[]>(initialMoments);
  const [showCamera, setShowCamera] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Moments cleared/deleted here are hidden from background polls until the
  // server agrees, which prevents a card from flickering back in.
  const hiddenRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  const currentUser = user.id;
  const otherUser = users.find((candidate) => candidate.id !== currentUser);

  const sessionExpired = useCallback(() => {
    router.replace('/');
    router.refresh();
  }, [router]);

  const fetchMoments = useCallback(async (): Promise<Moment[] | null> => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;

    try {
      const res = await fetch('/api/moments', { cache: 'no-store' });
      if (res.status === 401) {
        sessionExpired();
        return null;
      }
      if (!res.ok) return null;

      const data = (await res.json()) as Moment[];
      if (!Array.isArray(data)) return null;

      const visible = data.filter((moment) => !hiddenRef.current.has(moment.id));
      startTransition(() => setMoments(visible));
      return visible;
    } catch (err) {
      console.error('Failed to fetch moments:', err);
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [sessionExpired]);

  // The previous build remembered cleared cards only on this device. Push
  // those ids to the server once so previously seen moments do not return.
  useEffect(() => {
    let ids: string[] = [];
    try {
      const raw = window.localStorage.getItem(LEGACY_CLEARED_KEY);
      window.localStorage.removeItem(LEGACY_CLEARED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        ids = parsed
          .filter((id): id is string => typeof id === 'string')
          .slice(-MAX_LEGACY_CLEARED_MOMENTS);
      }
    } catch {
      // Ignore unreadable legacy storage.
    }
    if (ids.length === 0) return;

    const wanted = new Set(ids);
    ids.forEach((id) => hiddenRef.current.add(id));
    setMoments((prev) => prev.filter((moment) => !wanted.has(moment.id)));

    void fetch('/api/moments/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {
      // A failed migration just means those cards may return next time.
    });
  }, []);

  useEffect(() => {
    let interval: number | undefined;

    const tick = () => {
      if (document.visibilityState === 'visible') void fetchMoments();
    };

    const startPolling = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = window.setInterval(tick, MOMENT_POLL_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick();
        startPolling();
      } else if (interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };

    // Reconcile the server-rendered pile, then poll only while visible.
    tick();
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', tick);

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', tick);
    };
  }, [fetchMoments]);

  const uploadMoment = async (blob: Blob, type: 'photo' | 'voice') => {
    setSending(true);
    setError(null);
    try {
      const formData = new FormData();
      const mimeType = blob.type;
      const extension = type === 'photo' ? 'jpg' : audioExtension(mimeType);
      formData.append('file', blob, `moment.${extension}`);
      formData.append('type', type);
      formData.append('mimeType', mimeType);

      const res = await fetch('/api/moments', {
        method: 'POST',
        body: formData,
      });

      if (res.status === 401) {
        sessionExpired();
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Could not send your moment. Please try again.');
        return;
      }

      const created = (await res.json()) as Moment;
      if (created?.id) {
        setMoments((prev) =>
          prev.some((moment) => moment.id === created.id)
            ? prev
            : [...prev, created]
        );
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Could not send your moment. Please try again.');
    } finally {
      setSending(false);
      setShowCamera(false);
      setShowVoice(false);
    }
  };

  const markSeen = async (id: string) => {
    // Seen means gone for both of us: drop it immediately, then persist.
    hiddenRef.current.add(id);
    setMoments((prev) => prev.filter((moment) => moment.id !== id));

    try {
      const res = await fetch('/api/moments/seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.status === 401) {
        sessionExpired();
        return;
      }

      if (!res.ok) throw new Error(`Failed to mark moment seen (${res.status})`);
    } catch (err) {
      console.error('Mark seen failed:', err);
      hiddenRef.current.delete(id);
      const restored = await fetchMoments();
      if (restored?.some((moment) => moment.id === id)) {
        setError('Could not clear that moment. Please try again.');
      }
    }
  };

  const handleDelete = async (id: string) => {
    hiddenRef.current.add(id);
    setMoments((prev) => prev.filter((moment) => moment.id !== id));

    try {
      const res = await fetch('/api/moments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.status === 401) {
        sessionExpired();
        return;
      }

      if (!res.ok) throw new Error(`Failed to delete moment (${res.status})`);
    } catch (err) {
      console.error('Delete failed:', err);
      hiddenRef.current.delete(id);
      const restored = await fetchMoments();
      if (restored?.some((moment) => moment.id === id)) {
        setError('Could not delete that moment.');
      }
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/');
      router.refresh();
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-soft-bg">
      {/* Header */}
      <header className="glass shrink-0 border-b border-pink-100 safe-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{user.emoji}</span>
            <div>
              <h1 className="text-lg font-bold gradient-text">Meow</h1>
              <p className="text-xs text-gray-400">
                {otherUser ? `Sharing with ${otherUser.name}` : 'Sharing together'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <InstallButton />
            <button
              onClick={signOut}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5
                rounded-full border border-gray-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Feed */}
      <main className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col px-4 pt-3">
        {error && (
          <div
            role="alert"
            className="mb-3 shrink-0 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1">
          <MomentStack
            moments={moments}
            currentUser={currentUser}
            users={users}
            onSeen={markSeen}
            onDelete={handleDelete}
          />
        </div>
      </main>

      {/* Sending toast */}
      {sending && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center
            pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
        >
          <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2
            text-sm font-medium text-gray-600 shadow-lg backdrop-blur animate-slide-up">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2
                border-warm-pink border-t-transparent"
            />
            Sending moment…
          </div>
        </div>
      )}

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-3 safe-bottom">
        {showMenu && (
          <div className="flex flex-col gap-3 animate-slide-up">
            <button
              onClick={() => {
                setShowMenu(false);
                setShowCamera(true);
              }}
              aria-label="Take a photo"
              className="w-14 h-14 rounded-full bg-linear-to-r from-pink-400 to-rose-500
                text-white shadow-lg flex items-center justify-center text-2xl
                transform transition-all active:scale-90"
            >
              📸
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                setShowVoice(true);
              }}
              aria-label="Record a voice message"
              className="w-14 h-14 rounded-full bg-linear-to-r from-purple-400 to-indigo-500
                text-white shadow-lg flex items-center justify-center text-2xl
                transform transition-all active:scale-90"
            >
              🎙️
            </button>
          </div>
        )}
        <button
          onClick={() => setShowMenu(!showMenu)}
          aria-label={showMenu ? 'Close menu' : 'Add a moment'}
          aria-expanded={showMenu}
          className={`w-16 h-16 rounded-full gradient-primary text-white shadow-xl
            flex items-center justify-center text-3xl
            transform transition-all duration-300 active:scale-90
            ${showMenu ? 'rotate-45' : ''}`}
        >
          +
        </button>
      </div>

      <InstallPrompt />

      {/* Click-away for menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Camera */}
      {showCamera && (
        <CameraCapture
          onCapture={(blob) => uploadMoment(blob, 'photo')}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* Voice Recorder */}
      {showVoice && (
        <VoiceRecorder
          onRecord={(blob) => uploadMoment(blob, 'voice')}
          onClose={() => setShowVoice(false)}
        />
      )}
    </div>
  );
}
