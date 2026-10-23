export interface PublicUser {
  id: string;
  name: string;
  emoji: string;
}

const EMOJIS: Record<string, string> = {
  user1: '🐱',
  user2: '🐾',
};

const PASSCODE_ENV: Record<string, string> = {
  user1: 'MEOW_USER1_PASSCODE',
  user2: 'MEOW_USER2_PASSCODE',
};

const NAME_ENV: Record<string, string> = {
  user1: 'MEOW_USER1_NAME',
  user2: 'MEOW_USER2_NAME',
};

const USER_IDS = ['user1', 'user2'];

const encoder = new TextEncoder();

function readName(userId: string): string {
  const value = process.env[NAME_ENV[userId]]?.trim();
  const fallback = userId === 'user1' ? 'Person 1' : 'Person 2';
  return value || fallback;
}

export const USERS: PublicUser[] = USER_IDS.map((id) => ({
  id,
  name: readName(id),
  emoji: EMOJIS[id],
}));

export function findUserById(userId: string): PublicUser | null {
  return USERS.find((user) => user.id === userId) ?? null;
}

function getPasscode(userId: string): string | null {
  const value = process.env[PASSCODE_ENV[userId]];
  return value ? value : null;
}

/** Constant-time-ish comparison so passcode checks don't leak through timing. */
function safeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

export function verifyCredentials(userId: string, passcode: string): PublicUser | null {
  const expected = getPasscode(userId);
  if (!expected) return null;
  if (!safeEqual(expected, passcode)) return null;
  return findUserById(userId);
}

/**
 * Returns a human readable configuration problem, or null when auth is ready.
 * Checked at request time so a misconfigured deploy fails closed with a clear log.
 */
export function getAuthConfigError(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return 'SESSION_SECRET must be set to at least 32 characters.';
  }
  for (const userId of USER_IDS) {
    const passcode = getPasscode(userId);
    if (!passcode) {
      return `${PASSCODE_ENV[userId]} is not set.`;
    }
    if (passcode.length < 6) {
      return `${PASSCODE_ENV[userId]} must be at least 6 characters.`;
    }
  }
  return null;
}
