import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { USERS } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json(
    { user, users: USERS },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
