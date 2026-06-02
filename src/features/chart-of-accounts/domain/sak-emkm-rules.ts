import { AccountGroupCode, AccountTemplateItem, ChartOfAccountsError, NormalBalance } from "./chart-of-accounts-types";

const ACCOUNT_CODE_PATTERN = /^[1-7][0-9]{5}$/;

export function expectedNormalBalanceForGroup(groupCode: AccountGroupCode): NormalBalance {
  if (groupCode === 1 || groupCode === 5 || groupCode === 6 || groupCode === 7) return "DEBIT";
  return "CREDIT";
}

export function groupCodeFromAccountCode(code: string): AccountGroupCode {
  assertValidAccountCodeFormat(code);
  return Number(code[0]) as AccountGroupCode;
}

export function assertValidAccountCodeFormat(code: string): void {
  if (!ACCOUNT_CODE_PATTERN.test(code)) {
    throw new ChartOfAccountsError("INVALID_ACCOUNT_CODE", "Account code must be exactly 6 digits and start with 1-7.", { code });
  }
}

export function assertAccountCodeMatchesGroup(code: string, groupCode: AccountGroupCode): void {
  const actualGroup = groupCodeFromAccountCode(code);
  if (actualGroup !== groupCode) {
    throw new ChartOfAccountsError("ACCOUNT_CODE_GROUP_MISMATCH", "Account code prefix must match the account group.", {
      code,
      groupCode,
      actualGroup
    });
  }
}

export function assertNormalBalanceMatchesGroup(groupCode: AccountGroupCode, normalBalance: NormalBalance): void {
  const expected = expectedNormalBalanceForGroup(groupCode);
  if (normalBalance !== expected) {
    throw new ChartOfAccountsError("NORMAL_BALANCE_GROUP_MISMATCH", "Normal balance must match SAK EMKM account group rules.", {
      groupCode,
      normalBalance,
      expected
    });
  }
}

export function assertParentChildCode(parentCode: string, childCode: string): void {
  assertValidAccountCodeFormat(parentCode);
  assertValidAccountCodeFormat(childCode);

  if (parentCode === childCode) {
    throw new ChartOfAccountsError("ACCOUNT_CANNOT_PARENT_ITSELF", "An account cannot be its own parent.", { code: childCode });
  }

  if (parentCode[0] !== childCode[0]) {
    throw new ChartOfAccountsError("PARENT_GROUP_MISMATCH", "Parent account must belong to the same account group.", {
      parentCode,
      childCode
    });
  }

  const parentDepth = accountCodeDepth(parentCode);
  const childDepth = accountCodeDepth(childCode);
  if (parentDepth >= childDepth) {
    throw new ChartOfAccountsError("INVALID_PARENT_DEPTH", "Parent account must be higher in the account hierarchy.", {
      parentCode,
      childCode,
      parentDepth,
      childDepth
    });
  }
}

export function accountCodeDepth(code: string): number {
  assertValidAccountCodeFormat(code);
  if (code.endsWith("0000")) return 1;
  if (code.endsWith("00")) return 2;
  return 3;
}

export const SAK_EMKM_STANDARD_ACCOUNTS: AccountTemplateItem[] = [
  { code: "100000", name: "Aset", groupCode: 1, subtype: "asset", isPostingAllowed: false, isSystem: true },
  { code: "110000", name: "Aset Lancar", groupCode: 1, subtype: "current_asset", parentCode: "100000", isPostingAllowed: false, isSystem: true },
  { code: "110101", name: "Kas Tunai", groupCode: 1, subtype: "cash", parentCode: "110000", isPostingAllowed: true, isSystem: true },
  { code: "110102", name: "Kas di Bank", groupCode: 1, subtype: "bank", parentCode: "110000", isPostingAllowed: true, isSystem: true },
  { code: "110201", name: "Piutang Usaha", groupCode: 1, subtype: "accounts_receivable", parentCode: "110000", isPostingAllowed: true, isSystem: true },
  { code: "110301", name: "Persediaan Barang Dagang", groupCode: 1, subtype: "inventory", parentCode: "110000", isPostingAllowed: true, isSystem: true },
  { code: "110401", name: "Biaya Dibayar di Muka", groupCode: 1, subtype: "prepaid_expense", parentCode: "110000", isPostingAllowed: true, isSystem: true },
  { code: "120000", name: "Aset Tidak Lancar", groupCode: 1, subtype: "non_current_asset", parentCode: "100000", isPostingAllowed: false, isSystem: true },
  { code: "120101", name: "Tanah", groupCode: 1, subtype: "fixed_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "120201", name: "Bangunan", groupCode: 1, subtype: "fixed_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "120202", name: "Akumulasi Penyusutan Bangunan", groupCode: 1, subtype: "contra_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "120301", name: "Peralatan", groupCode: 1, subtype: "fixed_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "120302", name: "Akumulasi Penyusutan Peralatan", groupCode: 1, subtype: "contra_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "120401", name: "Kendaraan", groupCode: 1, subtype: "fixed_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "120402", name: "Akumulasi Penyusutan Kendaraan", groupCode: 1, subtype: "contra_asset", parentCode: "120000", isPostingAllowed: true, isSystem: true },
  { code: "200000", name: "Liabilitas", groupCode: 2, subtype: "liability", isPostingAllowed: false, isSystem: true },
  { code: "210000", name: "Liabilitas Jangka Pendek", groupCode: 2, subtype: "current_liability", parentCode: "200000", isPostingAllowed: false, isSystem: true },
  { code: "210101", name: "Utang Usaha", groupCode: 2, subtype: "accounts_payable", parentCode: "210000", isPostingAllowed: true, isSystem: true },
  { code: "210201", name: "Utang Bank Jangka Pendek", groupCode: 2, subtype: "short_term_loan", parentCode: "210000", isPostingAllowed: true, isSystem: true },
  { code: "210301", name: "Utang Pajak", groupCode: 2, subtype: "tax_payable", parentCode: "210000", isPostingAllowed: true, isSystem: true },
  { code: "210401", name: "Beban Akrual", groupCode: 2, subtype: "accrued_expense", parentCode: "210000", isPostingAllowed: true, isSystem: true },
  { code: "220000", name: "Liabilitas Jangka Panjang", groupCode: 2, subtype: "non_current_liability", parentCode: "200000", isPostingAllowed: false, isSystem: true },
  { code: "220101", name: "Utang Bank Jangka Panjang", groupCode: 2, subtype: "long_term_loan", parentCode: "220000", isPostingAllowed: true, isSystem: true },
  { code: "300000", name: "Ekuitas", groupCode: 3, subtype: "equity", isPostingAllowed: false, isSystem: true },
  { code: "310101", name: "Modal Pemilik / Modal Awal", groupCode: 3, subtype: "owner_capital", parentCode: "300000", isPostingAllowed: true, isSystem: true },
  { code: "310201", name: "Prive", groupCode: 3, subtype: "owner_draw", parentCode: "300000", isPostingAllowed: true, isSystem: true },
  { code: "310301", name: "Saldo Laba", groupCode: 3, subtype: "retained_earnings", parentCode: "300000", isPostingAllowed: true, isSystem: true },
  { code: "400000", name: "Pendapatan", groupCode: 4, subtype: "revenue", isPostingAllowed: false, isSystem: true },
  { code: "410101", name: "Pendapatan Usaha / Penjualan", groupCode: 4, subtype: "sales_revenue", parentCode: "400000", isPostingAllowed: true, isSystem: true },
  { code: "410201", name: "Pendapatan Jasa", groupCode: 4, subtype: "service_revenue", parentCode: "400000", isPostingAllowed: true, isSystem: true },
  { code: "410301", name: "Pendapatan Lain-lain", groupCode: 4, subtype: "other_revenue", parentCode: "400000", isPostingAllowed: true, isSystem: true },
  { code: "500000", name: "Harga Pokok", groupCode: 5, subtype: "cost_of_goods_sold", isPostingAllowed: false, isSystem: true },
  { code: "510101", name: "Harga Pokok Penjualan", groupCode: 5, subtype: "cogs", parentCode: "500000", isPostingAllowed: true, isSystem: true },
  { code: "510201", name: "Pembelian Barang Dagang", groupCode: 5, subtype: "merchandise_purchase", parentCode: "500000", isPostingAllowed: true, isSystem: true },
  { code: "600000", name: "Beban Operasional", groupCode: 6, subtype: "operating_expense", isPostingAllowed: false, isSystem: true },
  { code: "610101", name: "Beban Gaji dan Upah", groupCode: 6, subtype: "salary_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610201", name: "Beban Sewa", groupCode: 6, subtype: "rent_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610301", name: "Beban Listrik, Air, Telepon", groupCode: 6, subtype: "utilities_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610401", name: "Beban Transportasi", groupCode: 6, subtype: "transport_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610501", name: "Beban Perlengkapan dan ATK", groupCode: 6, subtype: "supplies_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610601", name: "Beban Pemasaran / Iklan", groupCode: 6, subtype: "marketing_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610701", name: "Beban Penyusutan Aset", groupCode: 6, subtype: "depreciation_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "610801", name: "Beban Lain-lain Operasional", groupCode: 6, subtype: "other_operating_expense", parentCode: "600000", isPostingAllowed: true, isSystem: true },
  { code: "700000", name: "Beban Lain-lain", groupCode: 7, subtype: "other_expense", isPostingAllowed: false, isSystem: true },
  { code: "710101", name: "Beban Bunga", groupCode: 7, subtype: "interest_expense", parentCode: "700000", isPostingAllowed: true, isSystem: true },
  { code: "710201", name: "Beban Pajak", groupCode: 7, subtype: "tax_expense", parentCode: "700000", isPostingAllowed: true, isSystem: true }
];

