import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { cookies } from 'next/headers';

const SESSION_SECRET = process.env.SESSION_SECRET || 'a_very_long_secret_key_of_32_characters_minimum!';
const ALGORITHM = 'aes-256-cbc';
const COOKIE_NAME = 'shopx-session';

// ------------------------------------------------------------------
// Cryptographic Password Hashing
// ------------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  try {
    const [salt, originalHash] = storedValue.split(':');
    if (!salt || !originalHash) return false;
    const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------
// Symmetric Session Encryption
// ------------------------------------------------------------------
export function encryptSession(data: unknown): string {
  const iv = randomBytes(16);
  const key = scryptSync(SESSION_SECRET, 'salt', 32);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptSession(token: string): Record<string, unknown> | null {
  try {
    const [ivHex, encryptedHex] = token.split(':');
    if (!ivHex || !encryptedHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const key = scryptSync(SESSION_SECRET, 'salt', 32);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Next.js Cookie Helpers
// ------------------------------------------------------------------
export async function setSessionCookie(user: { uid: string; email: string }) {
  const sessionData = {
    uid: user.uid,
    email: user.email,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const token = encryptSession(sessionData);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

export async function getSessionUser(): Promise<{ uid: string; email: string } | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(COOKIE_NAME);
  if (!tokenCookie?.value) return null;

  const sessionData = decryptSession(tokenCookie.value);
  if (!sessionData || (sessionData.expiresAt as number) < Date.now()) {
    return null;
  }

  return {
    uid: sessionData.uid as string,
    email: sessionData.email as string,
  };
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}