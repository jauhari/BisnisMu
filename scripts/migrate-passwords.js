/**
 * Migration script: Re-hash all argon2 passwords to bcrypt.
 * 
 * Run from project root (lokal) dimana argon2 native bisa jalan:
 *   node scripts/migrate-passwords.js
 * 
 * IMPORTANT: Pastikan .env lokal punya DATABASE_URL yang benar (production Neon).
 */
const path = require('path');
const { PrismaClient } = require(path.resolve('node_modules/@prisma/client'));
const argon2 = require(path.resolve('node_modules/argon2'));
const bcrypt = require(path.resolve('node_modules/bcryptjs'));

// Load .env
require(path.resolve('node_modules/dotenv')).config();

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🔍 Looking for auth accounts with argon2 password hashes...\n');

  const accounts = await prisma.authAccount.findMany({
    where: { providerId: 'credential', password: { not: null } },
    select: { id: true, accountId: true, password: true },
  });

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const acc of accounts) {
    if (!acc.password) {
      skipped++;
      continue;
    }

    if (acc.password.startsWith('$argon2')) {
      console.log(`  🔄 Migrating: ${acc.accountId}`);
      
      // We can't verify/rehash without the plaintext password.
      // Instead, we'll need the user to reset their password.
      // But we CAN re-hash if we know the password...
      // 
      // Since we can't get the plaintext, we'll create a new bcrypt hash
      // from a temporary password and require the user to reset.
      //
      // ALTERNATIVE: Leave argon2 hashes and let the dynamic import
      // in password.ts handle it on local/non-Vercel environments.
      // On Vercel, users with argon2 hashes won't be able to login
      // until they reset their password.
      
      console.log(`    ⚠️  Cannot re-hash without plaintext password.`);
      console.log(`    ℹ️  User must reset password or re-register.`);
      errors++;
    } else if (acc.password.startsWith('$2a$') || acc.password.startsWith('$2b$')) {
      console.log(`  ✅ Already bcrypt: ${acc.accountId}`);
      skipped++;
    } else {
      console.log(`  ❓ Unknown hash format: ${acc.accountId} (${acc.password.substring(0, 10)}...)`);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Total accounts: ${accounts.length}`);
  console.log(`  Already bcrypt: ${skipped}`);
  console.log(`  Needs attention: ${errors}`);
  console.log(`  Migrated: ${migrated}`);
  
  if (errors > 0) {
    console.log('\n⚠️  Users with argon2 hashes need their passwords reset.');
    console.log('   Option 1: Admin resets password via /api/admin/users');
    console.log('   Option 2: User re-registers');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
