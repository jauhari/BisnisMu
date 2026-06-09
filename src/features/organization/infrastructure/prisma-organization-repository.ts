import type { PrismaClient } from "@prisma/client";
import type {
  BusinessUnitRef,
  CreateOrganizationInput,
  OrganizationDetail,
  OrganizationEntity,
  OrgMemberEntity,
  OrgRole,
  OrgType,
  UpdateOrganizationInput,
} from "../domain/organization-types";
import type { OrganizationRepository, OrganizationSummary } from "../application/organization-repository";

type OrgRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  address: string | null;
  npwpNumber: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

function mapOrg(row: OrgRow): OrganizationEntity {
  return {
    id: row.id,
    name: row.name,
    type: row.type as OrgType,
    description: row.description,
    address: row.address,
    npwpNumber: row.npwpNumber,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createOrganization(actorUserId: string, input: CreateOrganizationInput): Promise<OrganizationEntity> {
    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: input.name,
          type: input.type,
          description: input.description ?? null,
          address: input.address ?? null,
          npwpNumber: input.npwpNumber ?? null,
          createdById: actorUserId,
        },
      });
      await tx.orgMember.create({
        data: { organizationId: created.id, userId: actorUserId, role: "ORG_OWNER" },
      });
      return created;
    });
    return mapOrg(org);
  }

  async findOrganization(orgId: string): Promise<OrganizationDetail | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        businesses: { select: { id: true, name: true, type: true }, orderBy: { name: "asc" } },
        members: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { joinedAt: "asc" },
        },
      },
    });
    if (!org) return null;
    return {
      ...mapOrg(org),
      units: org.businesses.map((b): BusinessUnitRef => ({ id: b.id, name: b.name, type: b.type })),
      members: org.members.map((m): OrgMemberEntity => ({
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role as OrgRole,
        joinedAt: m.joinedAt,
        name: m.user.name,
        email: m.user.email,
      })),
    };
  }

  async listForUser(userId: string): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.orgMember.findMany({
      where: { userId },
      include: { organization: { include: { _count: { select: { businesses: true } } } } },
      orderBy: { joinedAt: "desc" },
    });
    return memberships.map((m): OrganizationSummary => ({
      ...mapOrg(m.organization),
      role: m.role as OrgRole,
      unitCount: m.organization._count.businesses,
    }));
  }

  async updateOrganization(orgId: string, input: UpdateOrganizationInput): Promise<OrganizationEntity> {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.npwpNumber !== undefined ? { npwpNumber: input.npwpNumber } : {}),
      },
    });
    return mapOrg(org);
  }

  async deleteOrganization(orgId: string): Promise<void> {
    await this.prisma.organization.delete({ where: { id: orgId } });
  }

  async getBusinessUnits(orgId: string): Promise<BusinessUnitRef[]> {
    const rows = await this.prisma.business.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });
    return rows.map((b) => ({ id: b.id, name: b.name, type: b.type }));
  }

  async findBusiness(businessId: string): Promise<{ id: string; name: string; organizationId: string | null } | null> {
    return this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, organizationId: true },
    });
  }

  async attachBusiness(orgId: string, businessId: string): Promise<void> {
    await this.prisma.business.update({ where: { id: businessId }, data: { organizationId: orgId } });
  }

  async detachBusiness(_orgId: string, businessId: string): Promise<void> {
    await this.prisma.business.update({ where: { id: businessId }, data: { organizationId: null } });
  }

  async getMember(orgId: string, userId: string): Promise<OrgMemberEntity | null> {
    const m = await this.prisma.orgMember.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
    if (!m) return null;
    return { organizationId: m.organizationId, userId: m.userId, role: m.role as OrgRole, joinedAt: m.joinedAt };
  }

  async listMembers(orgId: string): Promise<OrgMemberEntity[]> {
    const rows = await this.prisma.orgMember.findMany({
      where: { organizationId: orgId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
    return rows.map((m): OrgMemberEntity => ({
      organizationId: m.organizationId,
      userId: m.userId,
      role: m.role as OrgRole,
      joinedAt: m.joinedAt,
      name: m.user.name,
      email: m.user.email,
    }));
  }

  async upsertMember(orgId: string, userId: string, role: OrgRole): Promise<OrgMemberEntity> {
    const m = await this.prisma.orgMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      create: { organizationId: orgId, userId, role },
      update: { role },
    });
    return { organizationId: m.organizationId, userId: m.userId, role: m.role as OrgRole, joinedAt: m.joinedAt };
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.prisma.orgMember.delete({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });
  }

  async findUserByEmail(email: string): Promise<{ id: string; name: string; email: string } | null> {
    return this.prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  }
}
