'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import InstallButton from '@/components/InstallButton';

const LAST_USERNAME_KEY = 'meow:last-username';

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LAST_USERNAME_KEY);
      if (saved) setUsername(saved);
    } catch {
      // Storage can be unavailable (private mode); just start empty.
    }
  }, []);

  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (res.ok) {
        try {
          window.localStorage.setItem(LAST_USERNAME_KEY, username.trim());
        } catch {
          // Not important.
        }
        router.prefetch('/feed');
        router.replace('/feed');
        router.refresh();
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? 'Could not sign in. Please try again.');
      setPassword('');
      setSubmitting(false);
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="mb-10 animate-fade-in text-center">
        <h1 className="mb-3 text-5xl font-bold gradient-text">Meow</h1>
        <p className="text-lg text-gray-500">Share moments together 💕</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm animate-slide-up space-y-4 rounded-3xl
          border border-pink-100/80 bg-white p-6 shadow-lg"
      >
        <div>
          <label
            htmlFor="username"
            className="text-xs font-medium text-gray-500"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (error) setError(null);
            }}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            disabled={submitting}
            placeholder="your username"
            className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3
              text-base text-gray-800 placeholder:text-gray-300
              focus:outline-hidden focus:ring-2 focus:ring-warm-pink/50
              disabled:opacity-60"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="text-xs font-medium text-gray-500"
          >
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              autoComplete="current-password"
              enterKeyHint="go"
              disabled={submitting}
              placeholder="••••••••"
              className="w-full rounded-xl border border-gray-200 py-3 pl-4 pr-16
                text-base text-gray-800 placeholder:text-gray-300
                focus:outline-hidden focus:ring-2 focus:ring-warm-pink/50
                disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              disabled={submitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg
                px-2 py-1 text-xs font-medium text-gray-400 transition-colors
                hover:text-gray-600 disabled:opacity-50"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="text-center text-sm text-red-500"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-xl gradient-primary py-3 font-semibold text-white
            shadow-md transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-xs text-gray-300">
        Only the two of you can get in
      </p>

      <div className="mt-3">
        <InstallButton variant="text" />
      </div>
    </main>
  );
}
