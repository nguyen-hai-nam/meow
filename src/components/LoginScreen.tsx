'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PublicUser } from '@/lib/users';

const GRADIENTS = [
  'from-pink-400 to-rose-500',
  'from-purple-400 to-indigo-500',
];

interface LoginScreenProps {
  users: PublicUser[];
}

export default function LoginScreen({ users }: LoginScreenProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chooseUser = (user: PublicUser) => {
    setSelected(user);
    setPasscode('');
    setError(null);
  };

  const goBack = () => {
    if (submitting) return;
    setSelected(null);
    setPasscode('');
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, passcode }),
      });

      if (res.ok) {
        router.replace('/feed');
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? 'Could not sign in. Please try again.');
      setPasscode('');
      setSubmitting(false);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="animate-fade-in text-center mb-12">
        <h1 className="text-5xl font-bold gradient-text mb-3">Meow</h1>
        <p className="text-lg text-gray-500">Share moments together 💕</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {!selected ? (
          <>
            <p className="text-center text-gray-400 text-sm mb-6">Who are you?</p>
            {users.map((user, index) => (
              <button
                key={user.id}
                onClick={() => chooseUser(user)}
                className={`w-full p-6 rounded-2xl bg-linear-to-r ${
                  GRADIENTS[index % GRADIENTS.length]
                } text-white
                  transform transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                  shadow-lg hover:shadow-xl animate-slide-up`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className="text-4xl mb-2 block">{user.emoji}</span>
                <span className="text-xl font-semibold">{user.name}</span>
              </button>
            ))}
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="animate-slide-up rounded-2xl bg-white shadow-lg p-6 space-y-5"
          >
            <div className="text-center">
              <span className="text-4xl block mb-2">{selected.emoji}</span>
              <p className="text-lg font-semibold text-gray-700">{selected.name}</p>
              <p className="text-sm text-gray-400 mt-1">Enter your passcode</p>
            </div>

            <div>
              <label htmlFor="passcode" className="sr-only">
                Passcode
              </label>
              <input
                id="passcode"
                name="passcode"
                type="password"
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                autoFocus
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg
                  tracking-widest focus:outline-hidden focus:ring-2 focus:ring-warm-pink/50
                  disabled:opacity-60"
                placeholder="••••••"
              />
            </div>

            {error && (
              <p role="alert" className="text-center text-sm text-red-500">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500
                  font-medium transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || passcode.length === 0}
                className="flex-1 py-3 rounded-xl gradient-primary text-white font-semibold
                  transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? 'Unlocking…' : 'Unlock'}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-12 text-xs text-gray-300">
        {selected ? 'Only the two of you can get in' : 'Tap to enter your space'}
      </p>
    </main>
  );
}
