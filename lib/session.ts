import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { cookies } from 'next/headers';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'a_very_long_secret_key_of_32_characters_minimum!';
const ALGORITHM  = 'aes-256-cbc';
const COOKIE_NAME = 'shopx-session';

// ─────────────────────────────────────────────────────────────────────────────
// Password hashing  (pbkdf2 + random salt)
// ─────────────────────────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  try {
    // storedValue is always  <16-byte-hex-salt>:<128-byte-hex-hash>
    const colonIndex = storedValue.indexOf(':');
    if (colonIndex === -1) return false;
    const salt         = storedValue.slice(0, colonIndex);
    const originalHash = storedValue.slice(colonIndex + 1);
    const hash = pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session encryption  (AES-256-CBC)
// The token format is:  <32-char iv hex>:<rest of ciphertext>
// We split on the FIRST colon only so the ciphertext (which also contains
// colons when hex-encoded) is never truncated.
// ─────────────────────────────────────────────────────────────────────────────

export function encryptSession(data: unknown): string {
  const iv  = randomBytes(16);                          // 16 bytes → 32 hex chars
  const key = scryptSync(SESSION_SECRET, 'salt', 32);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  // iv hex is always exactly 32 chars — safe separator
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptSession(token: string): Record<string, unknown> | null {
  try {
    // ✅ Split on FIRST colon only — iv is always 32 hex chars
    const colonIndex  = token.indexOf(':');
    if (colonIndex === -1) return null;
    const ivHex        = token.slice(0, colonIndex);
    const encryptedHex = token.slice(colonIndex + 1);   // everything after first colon
    if (!ivHex || !encryptedHex) return null;

    const iv      = Buffer.from(ivHex, 'hex');
    const key     = scryptSync(SESSION_SECRET, 'salt', 32);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted  = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted     += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Next.js cookie helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function setSessionCookie(user: { uid: string; email: string }) {
  const sessionData = {
    uid:       user.uid,
    email:     user.email,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const token = encryptSession(sessionData);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   7 * 24 * 60 * 60,
  });
}

export async function getSessionUser(): Promise<{ uid: string; email: string } | null> {
  const cookieStore  = await cookies();
  const tokenCookie  = cookieStore.get(COOKIE_NAME);
  if (!tokenCookie?.value) return null;

  const sessionData = decryptSession(tokenCookie.value);
  if (!sessionData || (sessionData.expiresAt as number) < Date.now()) {
    return null;
  }

  return {
    uid:   sessionData.uid   as string,
    email: sessionData.email as string,
  };
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}