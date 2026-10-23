import { promises as fs } from 'fs';
import path from 'path';
import type { Moment } from '@/lib/types';

export type { Moment } from '@/lib/types';

const DATA_DIR = process.env.MEOW_DATA_DIR
  ? path.resolve(process.env.MEOW_DATA_DIR)
  : path.join(process.cwd(), 'data');
const MOMENTS_FILE = path.join(DATA_DIR, 'moments.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  try {
    await fs.access(MOMENTS_FILE);
  } catch {
    await fs.writeFile(MOMENTS_FILE, '[]', 'utf-8');
  }
}

export async function getMoments(): Promise<Moment[]> {
  await ensureDataDir();
  const data = await fs.readFile(MOMENTS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function addMoment(moment: Moment): Promise<void> {
  const moments = await getMoments();
  moments.unshift(moment);
  await fs.writeFile(MOMENTS_FILE, JSON.stringify(moments, null, 2), 'utf-8');
}

export type DeleteResult = 'deleted' | 'not_found' | 'forbidden';

export async function deleteMoment(id: string, ownerId: string): Promise<DeleteResult> {
  const moments = await getMoments();
  const moment = moments.find((m) => m.id === id);
  if (!moment) return 'not_found';
  // Ownership is enforced here, in the storage layer, so no caller can skip it.
  if (moment.from !== ownerId) return 'forbidden';

  const filtered = moments.filter((m) => m.id !== id);
  await fs.writeFile(MOMENTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');

  // Delete the file too
  try {
    const filePath = path.join(UPLOADS_DIR, moment.fileName);
    await fs.unlink(filePath);
  } catch {
    // File may already be gone
  }
  return 'deleted';
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
