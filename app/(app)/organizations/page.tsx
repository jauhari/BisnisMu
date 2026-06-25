import Link from "next/link";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { getAuthenticatedUserContextByToken, getServerSessionToken } from "@/presentation/auth/session";
import { prisma } from "@/presentation/api/prisma";
import { OrganizationCreateForm } from "./organization-create-form"; // client island for form

interface OrgSummary {
  id: string;
  name: string;
  type: string;
  role: string;
  unitCount: number;
}

export default async function Page() {
  const token = await getServerSessionToken();
  if (!token) {
    // layout should handle redirect, but safe
    return <div>Unauthorized</div>;
  }

  const context = await getAuthenticatedUserContextByToken(token);

  // Server fetch - no client bundle for this data
  const orgs = await prisma.organization.findMany({
    where: { members: { some: { userId: context.actorUserId } } },
    include: {
      _count: { select: { businesses: true } },
      members: {
        where: { userId: context.actorUserId },
        select: { role: true },
      },
    },
  });

  const list: OrgSummary[] = orgs.map((org) => ({
    id: org.id,
    name: org.name,
    type: org.type,
    role: org.members[0]?.role || "ORG_VIEWER",
    unitCount: org._count.businesses,
  }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Multi-Unit"
        title="Organisasi"
        description="Lembaga induk (BUMDes, koperasi, holding) yang menaungi beberapa unit usaha untuk laporan konsolidasi."
      />

      <OrganizationCreateForm />

      {list.length === 0 ? (
        <GlassPanel><p className="text-sm text-muted">Belum ada organisasi. Buat satu untuk menggabungkan beberapa unit usaha.</p></GlassPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((o) => (
            <Link key={o.id} href={`/organizations/${o.id}`}>
              <GlassPanel className="h-full cursor-pointer transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base font-semibold">{o.name}</p>
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">{o.role.replace("ORG_", "")}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{o.type}</p>
                <p className="mt-3 text-sm">{o.unitCount} unit usaha</p>
              </GlassPanel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
