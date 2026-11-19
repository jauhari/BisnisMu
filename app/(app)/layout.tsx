import { unstable_cache } from "next/cache";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SessionProvider } from "@/components/layout/session-context";
import { prisma } from "@/presentation/api/prisma";
import { canHardMutateOrganizationTransaction, organizationHardMutationEnabled } from "@/presentation/auth/permissions";
import { getAuthenticatedUserContextByToken, getServerSessionToken } from "@/presentation/auth/session";

/**
 * User + daftar usaha diambil SEKALI di server lalu dibagikan lewat
 * <SessionProvider>. Sebelumnya AppShell memanggil endpoint sesi dan
 * endpoint daftar usaha dari client pada setiap pemuatan halaman.
 */
const getCachedMemberships = unstable_cache(
  async (userId: string) =>
    prisma.businessMember.findMany({
      where: { userId, isActive: true },
      include: {
        business: {
          select: { id: true, name: true, organization: { select: { settings: true } } },
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
  ["shell-memberships"],
  { revalidate: 60, tags: ["shell-memberships"] },
);

async function loadShellData() {
  const token = await getServerSessionToken();
  if (!token) redirect("/login");

  // Now uses React.cache — multiple calls in the same render (layout + children) hit DB only once.
  const context = await getAuthenticatedUserContextByToken(token);
  if (!context.businessId) redirect("/select-business");

  // Daftar usaha jarang berubah, jadi di-cache 60 detik per user. Tanpa ini
  // setiap render layout membayar satu query lintas-region (~0,5 detik).
  // Hanya data statis yang di-cache; status `active` dihitung di luar cache
  // dari session aktif, sehingga ganti usaha tetap langsung terlihat.
  const memberships = await getCachedMemberships(context.actorUserId);

  const user = {
    id: context.user.id,
    name: context.user.name,
    email: context.user.email,
    platformRole: context.platformRole,
  };

  const businesses = memberships.map((membership) => ({
    id: membership.business.id,
    name: membership.business.name,
    role: membership.role as string,
    isActive: true,
    active: membership.business.id === context.businessId,
  }));

  // Sama seperti perhitungan di endpoint sesi. Kalau membership business aktif
  // tidak ditemukan, settings dianggap undefined → hardMutation false (aman).
  const activeMembership = memberships.find((membership) => membership.business.id === context.businessId);
  const hardMutation = canHardMutateOrganizationTransaction(
    context.role,
    organizationHardMutationEnabled(activeMembership?.business.organization?.settings),
  );

  return { user, businesses, activeBusinessId: context.businessId, hardMutation };
}

export default async function Layout({ children }: { children: ReactNode }) {
  const { user, businesses, activeBusinessId, hardMutation } = await loadShellData();

  return (
    <SessionProvider user={user} businesses={businesses} activeBusinessId={activeBusinessId} hardMutation={hardMutation}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
