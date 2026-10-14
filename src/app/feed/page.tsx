'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CameraCapture from '@/components/CameraCapture';
import VoiceRecorder from '@/components/VoiceRecorder';
import MomentCard from '@/components/MomentCard';

interface Moment {
  id: string;
  type: 'photo' | 'voice';
  from: string;
  caption?: string;
  fileName: string;
  createdAt: string;
}

export default function FeedPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = localStorage.getItem('meow-user');
    if (!user) {
      router.push('/');
      return;
    }
    setCurrentUser(user);
  }, [router]);

  const fetchMoments = useCallback(async () => {
    try {
      const res = await fetch('/api/moments');
      if (res.ok) {
        const data = await res.json();
        setMoments(data);
      }
    } catch (err) {
      console.error('Failed to fetch moments:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchMoments();
      // Poll every 5 seconds for new moments
      const interval = setInterval(fetchMoments, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser, fetchMoments]);

  const uploadMoment = async (blob: Blob, type: 'photo' | 'voice') => {
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, type === 'photo' ? 'photo.jpg' : 'voice.webm');
      formData.append('type', type);
      formData.append('from', currentUser);

      const res = await fetch('/api/moments', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchMoments();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setSending(false);
      setShowCamera(false);
      setShowVoice(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/moments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMoments((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const switchUser = () => {
    localStorage.removeItem('meow-user');
    router.push('/');
  };

  if (!mounted || !currentUser) return null;

  const otherUser = currentUser === 'user1' ? 'Person 2' : 'Person 1';
  const currentEmoji = currentUser === 'user1' ? '🐱' : '🐾';

  return (
    <div className="min-h-screen bg-soft-bg pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-pink-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentEmoji}</span>
            <div>
              <h1 className="text-lg font-bold gradient-text">Meow</h1>
              <p className="text-xs text-gray-400">Sharing with {otherUser}</p>
            </div>
          </div>
          <button
            onClick={switchUser}
            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5
              rounded-full border border-gray-200 transition-colors"
          >
            Switch
          </button>
        </div>
      </header>

      {/* Feed */}
      <main className="max-w-lg mx-auto px-4 pt-4">
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
              className="w-14 h-14 rounded-full bg-gradient-to-r from-pink-400 to-rose-500
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
              className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-400 to-indigo-500
                text-white shadow-lg flex items-center justify-center text-2xl
                transform transition-all active:scale-90"
            >
              🎙️
            </button>
          </div>
        )}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={`w-16 h-16 rounded-full gradient-primary text-white shadow-xl
            flex items-center justify-center text-3xl
            transform transition-all duration-300 active:scale-90
            ${showMenu ? 'rotate-45' : ''}`}
        >
          +
        </button>
      </div>

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
