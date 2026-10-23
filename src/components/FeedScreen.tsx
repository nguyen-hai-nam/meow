'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/CameraCapture';
import VoiceRecorder from '@/components/VoiceRecorder';
import MomentCard from '@/components/MomentCard';
import InstallPrompt from '@/components/InstallPrompt';
import InstallButton from '@/components/InstallButton';
import type { PublicUser } from '@/lib/users';

interface Moment {
  id: string;
  type: 'photo' | 'voice';
  from: string;
  caption?: string;
  fileName: string;
  createdAt: string;
}

interface FeedScreenProps {
  user: PublicUser;
  users: PublicUser[];
}

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

export default function FeedScreen({ user, users }: FeedScreenProps) {
  const router = useRouter();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser = user.id;
  const otherUser = users.find((candidate) => candidate.id !== currentUser);

  const sessionExpired = useCallback(() => {
    router.replace('/');
    router.refresh();
  }, [router]);

  const fetchMoments = useCallback(async () => {
    try {
      const res = await fetch('/api/moments', { cache: 'no-store' });
      if (res.status === 401) {
        sessionExpired();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setMoments(data);
      }
    } catch (err) {
      console.error('Failed to fetch moments:', err);
    }
  }, [sessionExpired]);

  useEffect(() => {
    fetchMoments();
    // Poll every 5 seconds for new moments
    const interval = setInterval(fetchMoments, 5000);
    return () => clearInterval(interval);
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

      await fetchMoments();
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Could not send your moment. Please try again.');
    } finally {
      setSending(false);
      setShowCamera(false);
      setShowVoice(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
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

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? 'Could not delete that moment.');
        return;
      }

      setMoments((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Could not delete that moment.');
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
    <div className="min-h-screen bg-soft-bg pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-pink-100 safe-top">
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
      <main className="max-w-lg mx-auto px-4 pt-4">
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500"
          >
            {error}
          </div>
        )}

        {moments.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <span className="text-6xl block mb-4">💌</span>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              No moments yet
            </h2>
            <p className="text-gray-400">
              Share your first photo or voice message!
            </p>
          </div>
        ) : (
          moments.map((moment) => (
            <MomentCard
              key={moment.id}
              moment={moment}
              currentUser={currentUser}
              users={users}
              onDelete={handleDelete}
            />
          ))
        )}
      </main>

      {/* Sending overlay */}
      {sending && (
        <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
            <span className="text-4xl block mb-3 animate-bounce">✨</span>
            <p className="text-gray-600 font-medium">Sending moment...</p>
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
