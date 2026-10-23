import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getUserFromRequest, unauthorized } from '@/lib/auth';

// Every upload is named `<uuid>.<ext>` by the POST handler, so only accept that.
const SAFE_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webm|m4a|mp4|ogg|wav|mp3)$/i;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
};

const BASE_HEADERS = {
  'Cache-Control': 'private, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
  'Accept-Ranges': 'bytes',
};

function parseRange(
  header: string,
  size: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  if (startRaw === '' && endRaw === '') return null;

  if (startRaw === '') {
    // Suffix range: "bytes=-500" means the last 500 bytes.
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(startRaw);
  const end = endRaw === '' ? size - 1 : Math.min(Number(endRaw), size - 1);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= size) return null;

  return { start, end };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const { filename } = params;
    if (!SAFE_FILENAME.test(filename)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const uploadsDir = path.resolve(path.join(process.cwd(), 'data', 'uploads'));
    const resolved = path.resolve(uploadsDir, filename);

    // Defence in depth: reject anything that escapes the uploads directory.
    const relative = path.relative(uploadsDir, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const file = await fs.readFile(resolved);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

    // iOS/Safari only streams media reliably when byte ranges are supported.
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      const range = parseRange(rangeHeader, file.byteLength);
      if (!range) {
        return new NextResponse(null, {
          status: 416,
          headers: { ...BASE_HEADERS, 'Content-Range': `bytes */${file.byteLength}` },
        });
      }

      const chunk = file.subarray(range.start, range.end + 1);
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          ...BASE_HEADERS,
          'Content-Type': contentType,
          'Content-Length': String(chunk.byteLength),
          'Content-Range': `bytes ${range.start}-${range.end}/${file.byteLength}`,
        },
      });
    }

    return new NextResponse(file, {
      headers: {
        ...BASE_HEADERS,
        'Content-Type': contentType,
        'Content-Length': String(file.byteLength),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
