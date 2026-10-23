import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { findUserByUsername, getAuthConfigError, verifyCredentials } from '@/lib/users';
import { clientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const configError = getAuthConfigError();
  if (configError) {
    console.error(`[auth] ${configError}`);
    return NextResponse.json(
      { error: 'Server authentication is not configured.' },
      { status: 500 }
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const limitKey = `login:${clientIp(request.headers)}:${username.toLowerCase()}`;
  const limit = rateLimit(limitKey, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' },
      }
    );
  }

  const candidate = findUserByUsername(username);
  // Use the same message for an unknown username and a wrong password.
  const user = candidate ? verifyCredentials(candidate.id, password) : null;
  if (!user) {
    return NextResponse.json(
      { error: 'Incorrect username or password' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  resetRateLimit(limitKey);

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
