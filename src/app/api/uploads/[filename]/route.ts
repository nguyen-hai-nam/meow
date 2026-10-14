import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    const filePath = path.join(process.cwd(), 'data', 'uploads', filename);

    // Security: ensure no path traversal
    const resolved = path.resolve(filePath);
    const uploadsDir = path.resolve(path.join(process.cwd(), 'data', 'uploads'));
    if (!resolved.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const file = await fs.readFile(filePath);

    let contentType = 'application/octet-stream';
    if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (filename.endsWith('.png')) {
      contentType = 'image/png';
    } else if (filename.endsWith('.webm')) {
      contentType = 'audio/webm';
    } else if (filename.endsWith('.mp4')) {
      contentType = 'video/mp4';
    }

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
