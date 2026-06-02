import {
  AccountSnapshot,
  AccountingError,
  FiscalPeriodSnapshot,
  JournalLineInput,
  PostJournalInput,
  ValidatedJournal
} from "./accounting-types";
import { assertPositiveMinorUnit, sumMinorUnits } from "./money";

export class AccountingEngine {
  validateJournal(input: PostJournalInput, accounts: AccountSnapshot[], fiscalPeriod: FiscalPeriodSnapshot): ValidatedJournal {
    this.assertBusinessScope(input, accounts, fiscalPeriod);
    this.assertFiscalPeriod(input.transactionDate, fiscalPeriod);
    this.assertLines(input.lines);

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const validatedLines = input.lines.map((line) => {
      const account = accountById.get(line.accountId);

      if (!account) {
        throw new AccountingError("ACCOUNT_NOT_FOUND", "Journal line account was not found in this business.", {
          accountId: line.accountId
        });
      }

      if (!account.isActive) {
        throw new AccountingError("ACCOUNT_INACTIVE", "Cannot post to an inactive account.", {
          accountId: account.id,
          accountCode: account.code
        });
      }

      if (!account.isPostingAllowed) {
        throw new AccountingError("ACCOUNT_NOT_POSTING", "Cannot post to a summary or control account.", {
          accountId: account.id,
          accountCode: account.code
        });
      }

      this.assertNormalBalance(account);

      return { ...line, account };
    });

    const totalDebit = sumMinorUnits(validatedLines.filter((line) => line.side === "DEBIT").map((line) => line.amount));
    const totalCredit = sumMinorUnits(validatedLines.filter((line) => line.side === "CREDIT").map((line) => line.amount));

    if (totalDebit !== totalCredit) {
      throw new AccountingError("UNBALANCED_JOURNAL", "Journal debit total must equal credit total.", {
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString()
      });
    }

    const journal: ValidatedJournal = {
      businessId: input.businessId,
      transactionDate: input.transactionDate,
      fiscalPeriod,
      source: input.source,
      description: input.description,
      lines: validatedLines,
      totalDebit,
      totalCredit
    };

    if (input.sourceId !== undefined) journal.sourceId = input.sourceId;
    if (input.idempotencyKey !== undefined) journal.idempotencyKey = input.idempotencyKey;

    return journal;
  }

  private assertBusinessScope(input: PostJournalInput, accounts: AccountSnapshot[], fiscalPeriod: FiscalPeriodSnapshot): void {
    if (!input.businessId) {
      throw new AccountingError("TENANT_REQUIRED", "businessId is required for every journal.");
    }

    const foreignAccount = accounts.find((account) => account.businessId !== input.businessId);
    if (foreignAccount) {
      throw new AccountingError("TENANT_ACCOUNT_MISMATCH", "All journal accounts must belong to the same business.", {
        accountId: foreignAccount.id,
        accountBusinessId: foreignAccount.businessId,
        journalBusinessId: input.businessId
      });
    }

    if (fiscalPeriod.businessId !== input.businessId) {
      throw new AccountingError("TENANT_PERIOD_MISMATCH", "Fiscal period must belong to the journal business.", {
        periodBusinessId: fiscalPeriod.businessId,
        journalBusinessId: input.businessId
      });
    }
  }

  private assertNormalBalance(account: AccountSnapshot): void {
    const expectedNormalBalance = account.groupCode === 1 || account.groupCode === 5 || account.groupCode === 6 || account.groupCode === 7 ? "DEBIT" : "CREDIT";

    if (account.normalBalance !== expectedNormalBalance) {
      throw new AccountingError("INVALID_NORMAL_BALANCE", "Account normal balance does not match its account group.", {
        accountId: account.id,
        accountCode: account.code,
        groupCode: account.groupCode,
        normalBalance: account.normalBalance,
        expectedNormalBalance
      });
    }
  }

  private assertFiscalPeriod(transactionDate: Date, fiscalPeriod: FiscalPeriodSnapshot): void {
    if (fiscalPeriod.isClosed) {
      throw new AccountingError("FISCAL_PERIOD_CLOSED", "Cannot post into a closed fiscal period.", {
        fiscalPeriodId: fiscalPeriod.id
      });
    }

    if (transactionDate < fiscalPeriod.startsOn || transactionDate > fiscalPeriod.endsOn) {
      throw new AccountingError("DATE_OUTSIDE_FISCAL_PERIOD", "Transaction date is outside the selected fiscal period.", {
        transactionDate: transactionDate.toISOString(),
        startsOn: fiscalPeriod.startsOn.toISOString(),
        endsOn: fiscalPeriod.endsOn.toISOString()
      });
    }
  }

  private assertLines(lines: JournalLineInput[]): void {
    if (lines.length < 2) {
      throw new AccountingError("JOURNAL_LINES_MINIMUM", "A journal must contain at least two lines.");
    }

    let hasDebit = false;
    let hasCredit = false;

    lines.forEach((line, index) => {
      if (line.side !== "DEBIT" && line.side !== "CREDIT") {
        throw new AccountingError("INVALID_SIDE", "Journal line side must be DEBIT or CREDIT.", { index });
      }

      assertPositiveMinorUnit(line.amount, "line.amount");
      hasDebit ||= line.side === "DEBIT";
      hasCredit ||= line.side === "CREDIT";
    });

    if (!hasDebit || !hasCredit) {
      throw new AccountingError("JOURNAL_REQUIRES_DEBIT_AND_CREDIT", "A journal must contain debit and credit lines.");
    }
  }
}

