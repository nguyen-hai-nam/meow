import { promises as fs } from 'fs';
import path from 'path';

export interface Moment {
  id: string;
  type: 'photo' | 'voice';
  from: string;
  caption?: string;
  fileName: string;
  createdAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
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

export async function deleteMoment(id: string): Promise<boolean> {
  const moments = await getMoments();
  const moment = moments.find((m) => m.id === id);
  if (!moment) return false;

  const filtered = moments.filter((m) => m.id !== id);
  await fs.writeFile(MOMENTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');

  // Delete the file too
  try {
    const filePath = path.join(UPLOADS_DIR, moment.fileName);
    await fs.unlink(filePath);
  } catch {
    // File may already be gone
  }
  return true;
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
