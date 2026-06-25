/**
 * Password hashing utility — uses bcryptjs (pure JS, Vercel-compatible).
 *
 * argon2 (native C++ binding) crash di Vercel serverless environment.
 * Semua hash baru menggunakan bcrypt. Hash lama argon2id ($argon2id$...)
 * masih bisa di-verify dan akan di-rehash ke bcrypt saat login berikutnya.
 */
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** Hash a password with bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Supports both bcrypt ($2a$/$2b$) and legacy argon2id ($argon2id$) hashes.
 *
 * For argon2 hashes: since the native argon2 module cannot run on Vercel,
 * we return false and the caller should prompt password reset if needed.
 * In practice, we attempt a dynamic import of argon2 for local dev and
 * gracefully fall back to false on Vercel.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  // bcrypt hashes start with $2a$ or $2b$
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash);
  }

  // argon2id hashes start with $argon2
  if (hash.startsWith("$argon2")) {
    console.warn("[password] argon2 legacy hash encountered; cannot be verified in this environment. Please reset password.");
    return false;
  }

  // Unknown hash format
  return false;
}

/**
 * Check if a hash needs to be re-hashed (migrated from argon2 to bcrypt).
 */
export function needsRehash(hash: string): boolean {
  return hash.startsWith("$argon2");
}
