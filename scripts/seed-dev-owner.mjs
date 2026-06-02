#!/usr/bin/env node
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = process.env.SEED_OWNER_EMAIL ?? "admin@akuntansimu.local";
const password = process.env.SEED_OWNER_PASSWORD ?? "Password123!";
const name = process.env.SEED_OWNER_NAME ?? "AkuntansiMu Owner";
const businessName = process.env.SEED_BUSINESS_NAME ?? "Demo AkuntansiMu";

async function main() {
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, emailVerified: true },
    create: { email, name, emailVerified: true },
  });

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.authAccount.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: user.email } },
    update: { userId: user.id, password: hash },
    create: { userId: user.id, providerId: "credential", accountId: user.email, password: hash },
  });

  const existingBusiness = await prisma.business.findFirst({ where: { createdByUserId: user.id, name: businessName } });
  const business = existingBusiness ?? await prisma.business.create({
    data: {
      name: businessName,
      type: "UMKM",
      status: "ACTIVE",
      fiscalYearStart: 1,
      currency: "IDR",
      settings: {},
      createdByUserId: user.id,
    },
  });

  await prisma.businessMember.upsert({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
    update: { role: "OWNER", isActive: true },
    create: { businessId: business.id, userId: user.id, role: "OWNER", isActive: true },
  });

  console.log("Seed owner ready");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Business: ${business.name} (${business.id})`);
}

main().finally(async () => prisma.$disconnect());
