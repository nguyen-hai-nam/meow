import { NextRequest, NextResponse } from 'next/server';
import { consumeMoments } from '@/lib/storage';
import { getUserFromRequest, unauthorized } from '@/lib/auth';

/**
 * Mark a shared moment as seen. The first person to clear a card consumes it
 * for both: it is removed from the feed and its media file is deleted.
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  let body: { id?: unknown; ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const candidates = Array.isArray(body.ids) ? body.ids : [body.id];
  const ids = [
    ...new Set(
      candidates
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ].slice(0, 100);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'Missing moment id' }, { status: 400 });
  }

  try {
    // Idempotent: the other person may have consumed it a moment earlier.
    const consumed = await consumeMoments(ids);
    return NextResponse.json(
      { success: true, consumed },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Consume error:', error);
    return NextResponse.json(
      { error: 'Failed to clear that moment' },
      { status: 500 }
    );
  }
}
