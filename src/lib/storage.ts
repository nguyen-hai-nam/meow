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
  const parsed: unknown = JSON.parse(data);
  return Array.isArray(parsed) ? (parsed as Moment[]) : [];
}

/** Atomic write so a concurrent GET never reads a half-written file. */
async function writeMoments(moments: Moment[]): Promise<void> {
  const tempFile = `${MOMENTS_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(moments, null, 2), 'utf-8');
  await fs.rename(tempFile, MOMENTS_FILE);
}

/**
 * The two of us can add and consume moments at the same time. A simple
 * in-process queue keeps read-modify-write cycles from resurrecting or losing
 * entries (a single container runs one Node process).
 */
let writeQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function removeFile(fileName: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOADS_DIR, fileName));
  } catch {
    // The file may already be gone.
  }
}

export function addMoment(moment: Moment): Promise<void> {
  return serialize(async () => {
    const moments = await getMoments();
    moments.unshift(moment);
    await writeMoments(moments);
  });
}

export type DeleteResult = 'deleted' | 'not_found' | 'forbidden';

export function deleteMoment(
  id: string,
  ownerId: string
): Promise<DeleteResult> {
  return serialize(async () => {
    const moments = await getMoments();
    const moment = moments.find((m) => m.id === id);
    if (!moment) return 'not_found';
    // Ownership is enforced here, in the storage layer, so no caller can skip it.
    if (moment.from !== ownerId) return 'forbidden';

    await writeMoments(moments.filter((m) => m.id !== id));
    await removeFile(moment.fileName);
    return 'deleted';
  });
}

/**
 * Mark moments as seen for both people. Seen moments are removed for good:
 * the records disappear from the feed and their media files are deleted.
 * Unknown ids are ignored, so clearing the same card twice is harmless.
 */
export function consumeMoments(ids: string[]): Promise<number> {
  return serialize(async () => {
    const wanted = new Set(ids);
    if (wanted.size === 0) return 0;

    const moments = await getMoments();
    const consumed = moments.filter((moment) => wanted.has(moment.id));
    if (consumed.length === 0) return 0;

    await writeMoments(moments.filter((moment) => !wanted.has(moment.id)));
    await Promise.all(consumed.map((moment) => removeFile(moment.fileName)));
    return consumed.length;
  });
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
