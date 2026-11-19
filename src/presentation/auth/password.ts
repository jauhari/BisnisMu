/**
 * Password hashing utility — uses bcryptjs (pure JS, Vercel-compatible).
 *
 * - New passwords are always hashed with bcrypt.
 * - Legacy argon2id hashes (from early seeds/registers) are supported for verification
 *   on local/dev environments via dynamic import. On first successful login, the hash
 *   is automatically migrated to bcrypt in the DB.
 * - On Vercel (no native argon2), argon2 users will get "invalid" and must reset password.
 */
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** Hash a password with bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a stored hash.
 * Supports bcrypt ($2a$/$2b$) and legacy argon2id hashes.
 *
 * When an argon2 hash verifies successfully on a capable environment (local dev),
 * we proactively migrate it to bcrypt so the account works everywhere.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  // bcrypt hashes start with $2a$ or $2b$
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$")) {
    return bcrypt.compare(password, hash);
  }

  // argon2id hashes start with $argon2
  if (hash.startsWith("$argon2")) {
    try {
      // Dynamic import: works on local (native bindings available) but fails gracefully on Vercel
      const argon2 = await import("argon2");
      const ok = await argon2.verify(hash, password);
      if (ok) {
        // Auto-migrate to bcrypt so the user can login in all environments going forward
        try {
          // Use relative import so this works reliably even if TS path aliases are not resolved
          const prismaMod = await import("../api/prisma") as { prisma?: any };
          const prisma = prismaMod.prisma;
          const newHash = await hashPassword(password);
          await prisma.authAccount.updateMany({
            where: { password: hash },
            data: { password: newHash },
          });
          console.log("[password] Migrated argon2 → bcrypt hash for a legacy credential account");
        } catch (migErr) {
          console.warn("[password] Verified via argon2 but could not migrate hash:", migErr);
        }
      }
      return ok;
    } catch (err) {
      console.warn("[password] argon2 verification unavailable (likely Vercel or missing native). Legacy account requires password reset.");
      return false;
    }
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
