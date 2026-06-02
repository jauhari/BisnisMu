import {
  AccountNode,
  ChartOfAccountsError,
  CreateAccountInput,
  UpdateAccountInput
} from "./chart-of-accounts-types";
import {
  assertAccountCodeMatchesGroup,
  assertNormalBalanceMatchesGroup,
  assertParentChildCode,
  expectedNormalBalanceForGroup
} from "./sak-emkm-rules";

export class ChartOfAccountsEngine {
  validateCreate(input: CreateAccountInput, existingByCode: AccountNode | null, parent: AccountNode | null): CreateAccountInput & { normalBalance: "DEBIT" | "CREDIT" } {
    this.assertTenant(input.businessId);
    this.assertName(input.name);

    if (existingByCode) {
      throw new ChartOfAccountsError("ACCOUNT_CODE_ALREADY_EXISTS", "Account code must be unique within a business.", {
        businessId: input.businessId,
        code: input.code
      });
    }

    assertAccountCodeMatchesGroup(input.code, input.groupCode);
    const normalBalance = input.normalBalance ?? expectedNormalBalanceForGroup(input.groupCode);
    assertNormalBalanceMatchesGroup(input.groupCode, normalBalance);

    if (input.parentCode) {
      if (!parent) {
        throw new ChartOfAccountsError("PARENT_ACCOUNT_NOT_FOUND", "Parent account was not found in this business.", {
          parentCode: input.parentCode
        });
      }

      if (parent.businessId !== input.businessId) {
        throw new ChartOfAccountsError("TENANT_PARENT_MISMATCH", "Parent account must belong to the same business.", {
          parentBusinessId: parent.businessId,
          businessId: input.businessId
        });
      }

      assertParentChildCode(parent.code, input.code);
      if (parent.groupCode !== input.groupCode) {
        throw new ChartOfAccountsError("PARENT_GROUP_MISMATCH", "Parent account group must match child account group.", {
          parentCode: parent.code,
          parentGroupCode: parent.groupCode,
          childCode: input.code,
          childGroupCode: input.groupCode
        });
      }
    }

    return { ...input, normalBalance };
  }

  validateUpdate(input: UpdateAccountInput, account: AccountNode | null): void {
    this.assertTenant(input.businessId);

    if (!account) {
      throw new ChartOfAccountsError("ACCOUNT_NOT_FOUND", "Account was not found in this business.", {
        accountId: input.accountId
      });
    }

    if (account.businessId !== input.businessId) {
      throw new ChartOfAccountsError("TENANT_ACCOUNT_MISMATCH", "Account must belong to the same business.", {
        accountBusinessId: account.businessId,
        businessId: input.businessId
      });
    }

    if (account.isSystem && input.isActive === false) {
      throw new ChartOfAccountsError("SYSTEM_ACCOUNT_CANNOT_BE_DEACTIVATED", "System accounts cannot be deactivated.", {
        accountId: account.id,
        code: account.code
      });
    }

    if (input.name !== undefined) this.assertName(input.name);
  }

  validateDelete(account: AccountNode | null, childCount: number, journalLineCount: number): "DELETE" | "DEACTIVATE" {
    if (!account) {
      throw new ChartOfAccountsError("ACCOUNT_NOT_FOUND", "Account was not found in this business.");
    }

    if (account.isSystem) {
      throw new ChartOfAccountsError("SYSTEM_ACCOUNT_CANNOT_BE_DELETED", "System accounts cannot be deleted.", {
        accountId: account.id,
        code: account.code
      });
    }

    if (childCount > 0) {
      throw new ChartOfAccountsError("ACCOUNT_HAS_CHILDREN", "Account with child accounts cannot be deleted.", {
        accountId: account.id,
        childCount
      });
    }

    if (journalLineCount > 0) {
      return "DEACTIVATE";
    }

    return "DELETE";
  }

  assertTemplateItem(item: CreateAccountInput): void {
    assertAccountCodeMatchesGroup(item.code, item.groupCode);
    assertNormalBalanceMatchesGroup(item.groupCode, item.normalBalance ?? expectedNormalBalanceForGroup(item.groupCode));
  }

  private assertTenant(businessId: string): void {
    if (!businessId) throw new ChartOfAccountsError("TENANT_REQUIRED", "businessId is required.");
  }

  private assertName(name: string): void {
    if (!name.trim()) throw new ChartOfAccountsError("ACCOUNT_NAME_REQUIRED", "Account name is required.");
    if (name.trim().length > 120) throw new ChartOfAccountsError("ACCOUNT_NAME_TOO_LONG", "Account name must be 120 characters or fewer.");
  }
}

