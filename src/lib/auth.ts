import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './session';
import { findUserById, type PublicUser } from './users';

async function resolveUser(token: string | undefined): Promise<PublicUser | null> {
  const session = await verifySessionToken(token);
  if (!session) return null;
  return findUserById(session.userId);
}

/** For server components and route handlers that can use next/headers. */
export async function getSessionUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  return resolveUser(cookieStore.get(SESSION_COOKIE)?.value);
}

/** For route handlers, reading the cookie straight off the request. */
export async function getUserFromRequest(request: NextRequest): Promise<PublicUser | null> {
  return resolveUser(request.cookies.get(SESSION_COOKIE)?.value);
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  );
}
