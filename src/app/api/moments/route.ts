import { NextRequest, NextResponse } from 'next/server';
import { getMoments, addMoment, deleteMoment } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const moments = await getMoments();
    return NextResponse.json(moments);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch moments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string;
    const from = formData.get('from') as string;
    const caption = formData.get('caption') as string | null;

    if (!file || !type || !from) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const ext = type === 'photo' ? '.jpg' : '.webm';
    const fileName = `${uuidv4()}${ext}`;
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadsDir, fileName), buffer);

    const moment = {
      id: uuidv4(),
      type: type as 'photo' | 'voice',
      from,
      caption: caption || undefined,
      fileName,
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
  try {
    const { id } = await request.json();
    const success = await deleteMoment(id);
    if (!success) {
      return NextResponse.json({ error: 'Moment not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
