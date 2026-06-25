/**
 * Reset password for a specific user — re-hash to bcrypt.
 * 
 * Usage:
 *   node scripts/reset-password.js barookahjaya@gmail.com NewPassword123
 * 
 * Jalankan dari project root dengan .env yang punya DATABASE_URL production.
 */
const path = require('path');
const { PrismaClient } = require(path.resolve('node_modules/@prisma/client'));
const bcrypt = require(path.resolve('node_modules/bcryptjs'));

require(path.resolve('node_modules/dotenv')).config();

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log('Usage: node scripts/reset-password.js <email> <new-password>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.log('❌ Password harus minimal 8 karakter.');
    process.exit(1);
  }

  console.log(`🔍 Looking up user: ${email}`);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) {
    console.log('❌ User not found!');

    const allUsers = await prisma.user.findMany({
      select: { email: true, name: true },
    });
    console.log('\n📋 Available users:');
    allUsers.forEach(u => console.log(`  - ${u.email} (${u.name})`));
    process.exit(1);
  }

  console.log(`✅ User found: ${user.name} (${user.email})`);

  const authAccount = user.accounts.find(a => a.providerId === 'credential');
  if (!authAccount) {
    console.log('❌ No credential account found for this user!');
    process.exit(1);
  }

  console.log(`📝 Current hash format: ${authAccount.password?.substring(0, 10)}...`);
  console.log(`🔄 Re-hashing password with bcrypt...`);

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.authAccount.update({
    where: { id: authAccount.id },
    data: { password: newHash },
  });

  console.log(`✅ Password updated successfully!`);
  console.log(`   Hash: ${newHash.substring(0, 20)}...`);
  console.log(`   User can now login at bisnismu.net with the new password.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
