import type {
  BusinessUnitRef,
  CreateOrganizationInput,
  OrganizationDetail,
  OrganizationEntity,
  OrgMemberEntity,
  OrgRole,
  UpdateOrganizationInput,
} from "../domain/organization-types";

export interface OrganizationSummary extends OrganizationEntity {
  role: OrgRole;
  unitCount: number;
}

export interface OrganizationRepository {
  createOrganization(actorUserId: string, input: CreateOrganizationInput): Promise<OrganizationEntity>;
  findOrganization(orgId: string): Promise<OrganizationDetail | null>;
  listForUser(userId: string): Promise<OrganizationSummary[]>;
  updateOrganization(orgId: string, input: UpdateOrganizationInput): Promise<OrganizationEntity>;
  deleteOrganization(orgId: string): Promise<void>;

  getBusinessUnits(orgId: string): Promise<BusinessUnitRef[]>;
  /** Mengembalikan organizationId saat ini dari sebuah business (untuk validasi). */
  findBusiness(businessId: string): Promise<{ id: string; name: string; organizationId: string | null } | null>;
  attachBusiness(orgId: string, businessId: string): Promise<void>;
  detachBusiness(orgId: string, businessId: string): Promise<void>;

  getMember(orgId: string, userId: string): Promise<OrgMemberEntity | null>;
  listMembers(orgId: string): Promise<OrgMemberEntity[]>;
  upsertMember(orgId: string, userId: string, role: OrgRole): Promise<OrgMemberEntity>;
  removeMember(orgId: string, userId: string): Promise<void>;

  findUserByEmail(email: string): Promise<{ id: string; name: string; email: string } | null>;
}
