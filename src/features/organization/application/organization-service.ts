import { OrganizationEngine } from "../domain/organization-engine";
import {
  type CreateOrganizationInput,
  type OrganizationDetail,
  type OrganizationEntity,
  type OrgMemberEntity,
  type OrgRole,
  OrganizationError,
  type UpdateOrganizationInput,
} from "../domain/organization-types";
import type { OrganizationRepository, OrganizationSummary } from "./organization-repository";

export class OrganizationService {
  constructor(
    private readonly repo: OrganizationRepository,
    private readonly engine = new OrganizationEngine(),
  ) {}

  private async requireMember(orgId: string, actorUserId: string): Promise<OrgMemberEntity> {
    const member = await this.repo.getMember(orgId, actorUserId);
    if (!member) throw new OrganizationError("FORBIDDEN", "Anda bukan anggota organisasi ini.");
    return member;
  }

  async listOrganizations(actorUserId: string): Promise<OrganizationSummary[]> {
    return this.repo.listForUser(actorUserId);
  }

  async createOrganization(actorUserId: string, input: CreateOrganizationInput): Promise<OrganizationEntity> {
    const name = this.engine.validateName(input.name);
    const type = this.engine.validateType(input.type);
    return this.repo.createOrganization(actorUserId, { ...input, name, type });
  }

  async getOrganization(actorUserId: string, orgId: string): Promise<OrganizationDetail> {
    await this.requireMember(orgId, actorUserId);
    const detail = await this.repo.findOrganization(orgId);
    if (!detail) throw new OrganizationError("NOT_FOUND", "Organisasi tidak ditemukan.");
    return detail;
  }

  async updateOrganization(actorUserId: string, orgId: string, input: UpdateOrganizationInput): Promise<OrganizationEntity> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canUpdateOrg(member.role)) throw new OrganizationError("FORBIDDEN", "Tidak boleh mengubah organisasi.");
    const patch: UpdateOrganizationInput = { ...input };
    if (input.name !== undefined) patch.name = this.engine.validateName(input.name);
    if (input.type !== undefined) patch.type = this.engine.validateType(input.type);
    return this.repo.updateOrganization(orgId, patch);
  }

  async deleteOrganization(actorUserId: string, orgId: string): Promise<void> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canDeleteOrg(member.role)) throw new OrganizationError("FORBIDDEN", "Hanya ORG_OWNER yang boleh menghapus organisasi.");
    // Lepaskan semua unit dulu agar businessId tetap valid (organizationId -> null).
    const units = await this.repo.getBusinessUnits(orgId);
    for (const unit of units) await this.repo.detachBusiness(orgId, unit.id);
    await this.repo.deleteOrganization(orgId);
  }

  // ── Unit usaha ────────────────────────────────────────────────────────────
  async addUnit(actorUserId: string, orgId: string, businessId: string): Promise<void> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canAddUnit(member.role)) throw new OrganizationError("FORBIDDEN", "Tidak boleh menambah unit usaha.");
    const business = await this.repo.findBusiness(businessId);
    if (!business) throw new OrganizationError("NOT_FOUND", "Unit usaha tidak ditemukan.");
    if (business.organizationId && business.organizationId !== orgId) {
      throw new OrganizationError("UNIT_ALREADY_ATTACHED", "Unit usaha ini sudah tergabung di organisasi lain.");
    }
    await this.repo.attachBusiness(orgId, businessId);
  }

  async removeUnit(actorUserId: string, orgId: string, businessId: string): Promise<void> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canRemoveUnit(member.role)) throw new OrganizationError("FORBIDDEN", "Hanya ORG_OWNER yang boleh melepas unit usaha.");
    const business = await this.repo.findBusiness(businessId);
    if (!business || business.organizationId !== orgId) {
      throw new OrganizationError("NOT_FOUND", "Unit usaha bukan bagian dari organisasi ini.");
    }
    await this.repo.detachBusiness(orgId, businessId);
  }

  // ── Anggota ───────────────────────────────────────────────────────────────
  async inviteMember(actorUserId: string, orgId: string, email: string, role: string): Promise<OrgMemberEntity> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canManageMembers(member.role)) throw new OrganizationError("FORBIDDEN", "Tidak boleh mengelola anggota.");
    const orgRole = this.engine.validateRole(role);
    const user = await this.repo.findUserByEmail(email.trim().toLowerCase());
    if (!user) throw new OrganizationError("USER_NOT_FOUND", "Pengguna dengan email tersebut tidak ditemukan.");
    return this.repo.upsertMember(orgId, user.id, orgRole);
  }

  async updateMemberRole(actorUserId: string, orgId: string, userId: string, role: string): Promise<OrgMemberEntity> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canManageMembers(member.role)) throw new OrganizationError("FORBIDDEN", "Tidak boleh mengelola anggota.");
    const orgRole = this.engine.validateRole(role);
    await this.ensureNotLastOwner(orgId, userId, orgRole);
    return this.repo.upsertMember(orgId, userId, orgRole);
  }

  async removeMember(actorUserId: string, orgId: string, userId: string): Promise<void> {
    const member = await this.requireMember(orgId, actorUserId);
    if (!this.engine.canManageMembers(member.role)) throw new OrganizationError("FORBIDDEN", "Tidak boleh mengelola anggota.");
    await this.ensureNotLastOwner(orgId, userId, null);
    await this.repo.removeMember(orgId, userId);
  }

  /** Cegah organisasi kehilangan ORG_OWNER terakhir. */
  private async ensureNotLastOwner(orgId: string, targetUserId: string, newRole: OrgRole | null): Promise<void> {
    const members = await this.repo.listMembers(orgId);
    const target = members.find((m) => m.userId === targetUserId);
    if (!target || target.role !== "ORG_OWNER") return;
    if (newRole === "ORG_OWNER") return; // tetap owner
    const otherOwners = members.filter((m) => m.role === "ORG_OWNER" && m.userId !== targetUserId);
    if (otherOwners.length === 0) {
      throw new OrganizationError("LAST_OWNER", "Tidak bisa menghapus/menurunkan ORG_OWNER terakhir. Tunjuk owner lain dulu.");
    }
  }
}
