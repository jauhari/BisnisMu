export type AccountGroupCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type NormalBalance = "DEBIT" | "CREDIT";

export interface TenantContext {
  businessId: string;
  actorUserId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AccountNode {
  id: string;
  businessId: string;
  code: string;
  name: string;
  groupCode: AccountGroupCode;
  subtype?: string | null;
  description?: string | null;
  normalBalance: NormalBalance;
  parentId?: string | null;
  parentCode?: string | null;
  isSystem: boolean;
  isPostingAllowed: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAccountInput {
  businessId: string;
  code: string;
  name: string;
  groupCode: AccountGroupCode;
  subtype?: string;
  description?: string;
  normalBalance?: NormalBalance;
  parentCode?: string;
  isSystem?: boolean;
  isPostingAllowed?: boolean;
}

export interface UpdateAccountInput {
  businessId: string;
  accountId: string;
  name?: string;
  description?: string | null;
  subtype?: string | null;
  isActive?: boolean;
}

export interface AccountTemplateItem {
  code: string;
  name: string;
  groupCode: AccountGroupCode;
  subtype?: string;
  description?: string;
  parentCode?: string;
  isPostingAllowed: boolean;
  isSystem: boolean;
}

export interface AccountTreeNode extends AccountNode {
  children: AccountTreeNode[];
}

export class ChartOfAccountsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ChartOfAccountsError";
  }
}

