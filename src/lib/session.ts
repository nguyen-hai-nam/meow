import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'meow_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET is missing or shorter than 32 characters.');
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export interface SessionPayload {
  userId: string;
  expiresAt: number;
}

export function createSessionToken(userId: string): string {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = Buffer.from(
    JSON.stringify({ u: userId, e: expiresAt }),
    'utf8'
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined | null
): SessionPayload | null {
  if (!token) return null;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!payload || !signature) return null;

  let expected: string;
  try {
    expected = sign(payload);
  } catch {
    // Fail closed: without a valid secret nobody is authenticated.
    return null;
  }

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const signatureBuffer = Buffer.from(signature, 'utf8');
  if (expectedBuffer.length !== signatureBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data?.u !== 'string' || typeof data?.e !== 'number') return null;
    if (data.e <= Date.now()) return null;
    return { userId: data.u, expiresAt: data.e };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  const secure =
    process.env.NODE_ENV === 'production' && process.env.MEOW_COOKIE_SECURE !== 'false';
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
