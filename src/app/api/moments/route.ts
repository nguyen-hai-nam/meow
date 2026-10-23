import { NextRequest, NextResponse } from 'next/server';
import { getMoments, addMoment, deleteMoment, getUploadsDir } from '@/lib/storage';
import { getUserFromRequest, unauthorized } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_CAPTION_LENGTH = 500;
const VALID_TYPES = ['photo', 'voice'] as const;
type MomentType = (typeof VALID_TYPES)[number];

/**
 * Browsers disagree on audio containers: Chrome/Firefox record WebM,
 * Safari (iOS) records MP4/AAC. Only these formats are accepted.
 */
const AUDIO_FORMATS: Record<string, { extension: string; mimeType: string }> = {
  'audio/webm': { extension: '.webm', mimeType: 'audio/webm' },
  'audio/mp4': { extension: '.m4a', mimeType: 'audio/mp4' },
  'audio/ogg': { extension: '.ogg', mimeType: 'audio/ogg' },
  'audio/wav': { extension: '.wav', mimeType: 'audio/wav' },
  'audio/x-wav': { extension: '.wav', mimeType: 'audio/wav' },
  'audio/mpeg': { extension: '.mp3', mimeType: 'audio/mpeg' },
};

function baseMime(value: string | undefined | null): string {
  return (value ?? '').split(';')[0].trim().toLowerCase();
}

function resolveAudioFormat(
  file: File,
  requestedMime: string | undefined
): { extension: string; mimeType: string } | null {
  for (const candidate of [requestedMime, file.type]) {
    const format = AUDIO_FORMATS[baseMime(candidate)];
    if (format) return format;
  }
  return null;
}

function isMomentType(value: unknown): value is MomentType {
  return value === 'photo' || value === 'voice';
}

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const moments = await getMoments();
    return NextResponse.json(moments, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to fetch moments:', error);
    return NextResponse.json({ error: 'Failed to fetch moments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type');
    const caption = formData.get('caption');
    const mimeTypeField = formData.get('mimeType');

    if (!(file instanceof File) || !isMomentType(type)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large (max 20 MB)' }, { status: 413 });
    }

    const requestedMime = typeof mimeTypeField === 'string' ? mimeTypeField : undefined;

    let fileName: string;
    let storedMimeType: string | undefined;

    if (type === 'photo') {
      fileName = `${randomUUID()}.jpg`;
    } else {
      const format = resolveAudioFormat(file, requestedMime);
      if (!format) {
        return NextResponse.json(
          { error: 'Unsupported audio format. Expected WebM, MP4/AAC, OGG or WAV.' },
          { status: 415 }
        );
      }
      fileName = `${randomUUID()}${format.extension}`;
      storedMimeType = format.mimeType;
    }

    const uploadsDir = getUploadsDir();
    await fs.mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadsDir, fileName), buffer);

    const moment = {
      id: randomUUID(),
      type,
      // Identity always comes from the verified session, never from the client.
      from: user.id,
      caption:
        typeof caption === 'string' && caption.trim()
          ? caption.trim().slice(0, MAX_CAPTION_LENGTH)
          : undefined,
      fileName,
      mimeType: storedMimeType,
      createdAt: new Date().toISOString(),
    };

    await addMoment(moment);
    return NextResponse.json(moment, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return unauthorized();

  let body: { id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json({ error: 'Missing moment id' }, { status: 400 });
  }

  try {
    const result = await deleteMoment(id, user.id);
    if (result === 'not_found') {
      return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
    }
    if (result === 'forbidden') {
      return NextResponse.json(
        { error: 'You can only delete your own moments' },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
