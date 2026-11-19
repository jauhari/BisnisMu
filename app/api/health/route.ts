import { prisma } from "@/presentation/api/prisma";

/** Lightweight ping — warms serverless + DB pool on app load */
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return Response.json({ ok: true, ts: Date.now() });
}