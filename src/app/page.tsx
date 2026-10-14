'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const users = [
  { id: 'user1', name: 'Person 1', emoji: '🐱', color: 'from-pink-400 to-rose-500' },
  { id: 'user2', name: 'Person 2', emoji: '🐾', color: 'from-purple-400 to-indigo-500' },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('meow-user');
    if (saved) {
      router.push('/feed');
    }
  }, [router]);

  const handleSelect = (userId: string) => {
    setSelectedUser(userId);
    localStorage.setItem('meow-user', userId);
    setTimeout(() => router.push('/feed'), 300);
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="animate-fade-in text-center mb-12">
        <h1 className="text-5xl font-bold gradient-text mb-3">Meow</h1>
        <p className="text-lg text-gray-500">Share moments together 💕</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <p className="text-center text-gray-400 text-sm mb-6">Who are you?</p>
        {users.map((user, index) => (
          <button
            key={user.id}
            onClick={() => handleSelect(user.id)}
            className={`w-full p-6 rounded-2xl bg-gradient-to-r ${user.color} text-white
              transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
              shadow-lg hover:shadow-xl
              ${
                selectedUser === user.id
                  ? 'scale-[0.98] ring-4 ring-white/50'
                  : ''
              }
              animate-slide-up`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <span className="text-4xl mb-2 block">{user.emoji}</span>
            <span className="text-xl font-semibold">{user.name}</span>
          </button>
        ))}
      </div>

      <p className="mt-12 text-xs text-gray-300">Tap to enter your space</p>
    </main>
  );
}
