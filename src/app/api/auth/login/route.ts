import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { findUserById, getAuthConfigError, verifyCredentials } from '@/lib/users';
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

  let body: { userId?: unknown; passcode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const userId = typeof body.userId === 'string' ? body.userId : '';
  const passcode = typeof body.passcode === 'string' ? body.passcode : '';

  if (!userId || !passcode) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  if (!findUserById(userId)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const limit = rateLimit(
    `login:${clientIp(request.headers)}:${userId}`,
    MAX_ATTEMPTS,
    WINDOW_MS
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds), 'Cache-Control': 'no-store' },
      }
    );
  }

  const user = verifyCredentials(userId, passcode);
  if (!user) {
    return NextResponse.json(
      { error: 'Incorrect passcode' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  resetRateLimit(`login:${clientIp(request.headers)}:${userId}`);

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ user }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
