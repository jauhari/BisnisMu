"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Search, Trash2 } from "lucide-react";

import {
  WorkspaceHeader,
  SplitWorkspace,
  DetailPanel,
} from "@/components/layout/workspace";
import {
  GlassErrorState,
  GlassSkeleton,
} from "@/components/feedback/glass-feedback";
import {
  ManagedForm,
  RhfTextField,
  RhfDataSelect,
  type ManagedFormRenderProps,
  type SelectOption,
} from "@/components/forms/rhf-form";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassInput } from "@/components/forms/glass-form";
import {
  useListQuery,
  usePostMutation,
} from "@/presentation/query/dashboard-hooks";
import { cn } from "@/presentation/theme/cn";

const schema = z.object({
  code: z.string().regex(/^[1-7]\d{5}$/, "6 digit, awali 1-7"),
  name: z.string().min(3),
  groupCode: z.enum([
    "ASSET",
    "LIABILITY",
    "EQUITY",
    "REVENUE",
    "COGS",
    "EXPENSE",
    "OTHER_EXPENSE",
  ]),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  parentCode: z.string().optional(),
  isPostingAllowed: z.enum(["true", "false"]),
});
type CoaForm = z.infer<typeof schema>;

type AccountNode = {
  id: string;
  code: string;
  name: string;
  groupCode: number | string;
  normalBalance: "DEBIT" | "CREDIT";
  parentCode?: string | null;
  isActive: boolean;
  isSystem: boolean;
  isPostingAllowed?: boolean;
  children?: AccountNode[];
};
type TreeRow = AccountNode & { level: number; childCount: number };
type EditingAccount = Pick<
  TreeRow,
  "id" | "name" | "isActive" | "code" | "isSystem" | "childCount"
>;
type GroupCode = CoaForm["groupCode"];

const GROUP_OPTIONS: SelectOption[] = [
  { value: "ASSET", label: "1 - Aset (Debit)" },
  { value: "LIABILITY", label: "2 - Liabilitas (Kredit)" },
  { value: "EQUITY", label: "3 - Ekuitas (Kredit)" },
  { value: "REVENUE", label: "4 - Pendapatan (Kredit)" },
  { value: "COGS", label: "5 - HPP (Debit)" },
  { value: "EXPENSE", label: "6 - Beban (Debit)" },
  { value: "OTHER_EXPENSE", label: "7 - Beban lain (Debit)" },
];
const GROUP_LABELS: Record<string, string> = {
  "1": "Aset",
  "2": "Liabilitas",
  "3": "Ekuitas",
  "4": "Pendapatan",
  "5": "HPP",
  "6": "Beban",
  "7": "Beban lain",
  ASSET: "Aset",
  LIABILITY: "Liabilitas",
  EQUITY: "Ekuitas",
  REVENUE: "Pendapatan",
  COGS: "HPP",
  EXPENSE: "Beban",
  OTHER_EXPENSE: "Beban lain",
};
const GROUP_TONE: Record<string, string> = {
  "1": "bg-success/12 text-success",
  "2": "bg-warning/12 text-warning",
  "3": "bg-accent/12 text-accent",
  "4": "bg-success/12 text-success",
  "5": "bg-danger/12 text-danger",
  "6": "bg-danger/12 text-danger",
  "7": "bg-danger/12 text-danger",
};
const GROUP_DIGIT: Record<GroupCode, string> = {
  ASSET: "1",
  LIABILITY: "2",
  EQUITY: "3",
  REVENUE: "4",
  COGS: "5",
  EXPENSE: "6",
  OTHER_EXPENSE: "7",
};
/** Label tampilan saja; nilai yang disimpan tetap DEBIT/CREDIT. */
const NORMAL_BALANCE_LABEL: Record<string, string> = { DEBIT: "Debit", CREDIT: "Kredit" };

const GROUP_NORMAL: Record<GroupCode, "DEBIT" | "CREDIT"> = {
  ASSET: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
  COGS: "DEBIT",
  EXPENSE: "DEBIT",
  OTHER_EXPENSE: "DEBIT",
};

function flattenTree(nodes: AccountNode[], level = 0): TreeRow[] {
  return nodes.flatMap((node) => [
    { ...node, level, childCount: node.children?.length ?? 0 },
    ...flattenTree(node.children ?? [], level + 1),
  ]);
}

/** Baris anak disembunyikan kalau induknya ditutup. Induk yang punya anak = baris dengan childCount > 0. */
function visibleRows(
  rows: TreeRow[],
  collapsed: ReadonlySet<string>,
): TreeRow[] {
  const result: TreeRow[] = [];
  let hiddenBelowLevel: number | null = null;
  for (const row of rows) {
    if (hiddenBelowLevel !== null) {
      if (row.level > hiddenBelowLevel) continue;
      hiddenBelowLevel = null;
    }
    result.push(row);
    if (row.childCount > 0 && collapsed.has(row.code))
      hiddenBelowLevel = row.level;
  }
  return result;
}
function groupKey(groupCode: number | string) {
  return String(groupCode).replace(/\D/g, "") || String(groupCode);
}
function groupLabel(groupCode: number | string) {
  return (
    GROUP_LABELS[String(groupCode)] ??
    GROUP_LABELS[groupKey(groupCode)] ??
    `Grup ${groupCode}`
  );
}
function groupTone(groupCode: number | string) {
  return GROUP_TONE[groupKey(groupCode)] ?? "bg-slate-950/5 text-muted";
}
function stats(rows: TreeRow[]) {
  return {
    total: rows.length,
    parent: rows.filter((r) => r.childCount > 0).length,
    posting: rows.filter((r) => r.isPostingAllowed).length,
  };
}

function nextAccountCode(
  rows: TreeRow[],
  groupCode: GroupCode,
  parentCode?: string,
) {
  const digit = GROUP_DIGIT[groupCode];
  const parent = parentCode
    ? rows.find((row) => row.code === parentCode)
    : null;
  const siblings = rows.filter(
    (row) =>
      (parentCode
        ? row.parentCode === parentCode
        : !row.parentCode && row.code.startsWith(digit)) &&
      /^\d{6}$/.test(row.code),
  );
  const step = parent ? (parent.level === 0 ? 100 : 1) : 10000;
  const base = parent ? Number(parent.code) : Number(`${digit}00000`);
  const max = siblings.reduce(
    (current, row) => Math.max(current, Number(row.code)),
    base,
  );
  return String(max + step).padStart(6, "0");
}

/** Kode akun: dibaca "1-1110" supaya tidak menuntut mata memisah digit sendiri. */
function formatCode(code: string) {
  return /^\d{6}$/.test(code) ? `${code.slice(0, 1)}-${code.slice(1)}` : code;
}

function CoaFormFields({
  form,
  rows,
  editing,
}: {
  form: ManagedFormRenderProps<CoaForm>["form"];
  rows: TreeRow[];
  editing: EditingAccount | null;
}) {
  const groupCode = form.watch("groupCode");
  const parentCode = form.watch("parentCode");
  const isPostingAllowed = form.watch("isPostingAllowed");
  const parentOptions = rows
    .filter(
      (row) =>
        row.code.startsWith(GROUP_DIGIT[groupCode]) && !row.isPostingAllowed,
    )
    .map((row) => ({
      value: row.code,
      label: `${"  ".repeat(row.level)}${row.name} (${row.code})`,
    }));
  useEffect(() => {
    if (editing) return;
    form.setValue(
      "code",
      nextAccountCode(rows, groupCode, parentCode || undefined),
      { shouldDirty: true, shouldValidate: true },
    );
    form.setValue("normalBalance", GROUP_NORMAL[groupCode], {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [editing, form, groupCode, parentCode, rows]);
  return (
    <div className="grid max-w-[560px] gap-4">
      <label className="grid gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Kode akun
        </span>
        <GlassInput
          value={form.watch("code")}
          readOnly
          className="h-11 bg-slate-950/5 text-muted"
        />
      </label>
      <RhfTextField<CoaForm>
        name="name"
        label="Nama akun"
        placeholder="Bank BRI / Kas Operasional"
      />
      <RhfDataSelect<CoaForm>
        name="groupCode"
        label="Grup"
        options={GROUP_OPTIONS}
        placeholder="Pilih grup"
        loading={Boolean(editing)}
      />
      <RhfDataSelect<CoaForm>
        name="parentCode"
        label="Induk akun"
        options={[{ value: "", label: "Tanpa induk" }, ...parentOptions]}
        placeholder="Pilih induk akun"
        loading={Boolean(editing)}
      />
      <RhfDataSelect<CoaForm>
        name="isPostingAllowed"
        label="Tipe akun"
        options={[
          { value: "false", label: "Header / kategori" },
          { value: "true", label: "Posting / dipakai jurnal" },
        ]}
        placeholder="Pilih tipe akun"
        loading={Boolean(editing)}
      />
      <div className="grid gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Saldo normal
        </span>
        <div className="rounded-md border border-border bg-slate-950/5 px-3 py-2.5 text-sm font-medium text-muted dark:bg-white/8">
          {NORMAL_BALANCE_LABEL[form.watch("normalBalance")] ?? form.watch("normalBalance")}
        </div>
        <p className="text-xs leading-5 text-muted">
          Otomatis dari grup akun. Aset/Beban normalnya Debit;
          Liabilitas/Ekuitas/Pendapatan normalnya Kredit.
        </p>
      </div>
      <p className="text-xs leading-5 text-muted">
        {isPostingAllowed === "false"
          ? "Header dipakai untuk membuat kategori seperti Kas atau Bank."
          : "Akun posting dipakai untuk transaksi jurnal."}{" "}
        Kode otomatis mengikuti induk dan nomor terakhir.
      </p>
      <button
        type="submit"
        className="h-11 w-full rounded-md bg-foreground px-4 text-sm font-medium text-background"
      >
        {editing ? "Simpan perubahan" : "Simpan akun"}
      </button>
    </div>
  );
}

const BADGE =
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";
const ACTION =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-2 text-xs transition hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10";

export default function Page() {
  const mutation = usePostMutation("/api/accounting/chart-of-accounts");
  const seed = usePostMutation("/api/accounting/chart-of-accounts/seed");
  const [editing, setEditing] = useState<EditingAccount | null>(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const accountsQuery = useListQuery<AccountNode[]>(
    "/api/accounting/chart-of-accounts",
    ["list", "accounting-coa"],
  );
  const { data, isLoading, error } = accountsQuery;

  const allRows = useMemo(() => flattenTree(data?.data ?? []), [data]);

  /** Pencarian dan filter grup memaksa baris anak ikut tampil supaya hasilnya tidak tersembunyi. */
  const searching = query.trim() !== "" || groupFilter !== "ALL";
  const rows = useMemo(() => {
    if (!searching) return visibleRows(allRows, collapsed);
    const needle = query.trim().toLowerCase();
    return allRows.filter((row) => {
      const matchesText =
        !needle ||
        row.name.toLowerCase().includes(needle) ||
        row.code.includes(needle);
      const matchesGroup =
        groupFilter === "ALL" || groupKey(row.groupCode) === groupFilter;
      return matchesText && matchesGroup;
    });
  }, [allRows, collapsed, query, groupFilter, searching]);

  const summary = stats(allRows);

  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data)
    return (
      <GlassErrorState
        title="Bagan akun tidak tersedia"
        description="Gagal memuat bagan akun. Muat ulang halaman atau hubungi admin bila berlanjut."
      />
    );

  async function requestAccount(path: string, method: string, body?: unknown) {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(path, init);
    const json = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        json?.message ?? json?.error?.message ?? "Aksi akun gagal.",
      );
    await accountsQuery.refetch?.();
    return json;
  }

  function toggleCollapse(code: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Pembukuan"
        title="Bagan Akun"
        description="Hierarki akun SAK EMKM untuk pencatatan jurnal dan laporan."
        action={
          allRows.length === 0 ? (
            <button
              type="button"
              onClick={() => seed.mutate({})}
              className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background"
            >
              Buat akun SAK EMKM
            </button>
          ) : undefined
        }
      />

      <SplitWorkspace
        main={
          <GlassPanel className="p-0">
            <div className="grid gap-4 border-b border-border/70 bg-white/35 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">Hierarki akun</h2>
                  <p className="mt-1 text-sm text-muted">
                    Akun header mengelompokkan buku besar; akun posting dipakai
                    untuk baris jurnal.
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2 text-xs">
                  <span
                    className={cn(
                      BADGE,
                      "bg-slate-950/5 text-muted dark:bg-white/8",
                    )}
                  >
                    {summary.total} akun
                  </span>
                  <span className={cn(BADGE, "bg-accent/12 text-accent")}>
                    {summary.parent} parent
                  </span>
                  <span className={cn(BADGE, "bg-success/12 text-success")}>
                    {summary.posting} posting
                  </span>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <GlassInput
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama atau kode akun…"
                    className="h-11 pl-9"
                  />
                </label>
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { value: "ALL", label: "Semua" },
                    { value: "1", label: "Aset" },
                    { value: "2", label: "Liabilitas" },
                    { value: "3", label: "Ekuitas" },
                    { value: "4", label: "Pendapatan" },
                    { value: "5", label: "HPP" },
                    { value: "6", label: "Beban" },
                    { value: "7", label: "Lain" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setGroupFilter(option.value)}
                      className={cn(
                        "h-11 shrink-0 rounded-md border px-3 text-xs transition",
                        groupFilter === option.value
                          ? "border-accent bg-accent/12 text-accent"
                          : "border-border text-muted hover:bg-white/60 dark:hover:bg-white/10",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {searching ? (
                <p className="text-xs text-muted">
                  {rows.length} akun cocok.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setQuery("");
                      setGroupFilter("ALL");
                    }}
                  >
                    Bersihkan
                  </button>
                </p>
              ) : null}
            </div>

            <div className="max-h-[min(70vh,660px)] overflow-y-auto">
              {/* Header kolom hanya muncul di layar lebar; di layar sempit tiap baris menjelaskan dirinya sendiri. */}
              <div className="coa-head border-b border-border/70 bg-slate-50/95 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted dark:bg-slate-950/95">
                <span className="coa-field-main">Akun</span>
                <span className="coa-field-group">Grup</span>
                <span className="coa-field-balance">Saldo</span>
                <span className="coa-field-status">Status</span>
                <span className="coa-actions text-right">Aksi</span>
              </div>

              {rows.length === 0 ? (
                <p className="px-5 py-12 text-center text-sm text-muted">
                  {searching
                    ? "Tidak ada akun yang cocok dengan pencarian."
                    : "Belum ada akun. Gunakan tombol Buat akun SAK EMKM."}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {rows.map((account) => {
                    const isHeader = !account.isPostingAllowed;
                    const indentation = {
                      paddingLeft: `${Math.min(account.level, 4) * 1}rem`,
                    };
                    return (
                      <li
                        key={account.id ?? account.code}
                        className={cn(
                          "coa-row grid items-center gap-2 px-4 py-3 transition-colors sm:px-5",
                          isHeader
                            ? "bg-accent/8 hover:bg-accent/12 dark:bg-accent/12 dark:hover:bg-accent/16"
                            : "hover:bg-accent/7 dark:hover:bg-accent/10",
                        )}
                      >
                        <div
                          className="coa-field coa-field-main flex min-w-0 items-start gap-2"
                          style={indentation}
                        >
                          {account.childCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(account.code)}
                              aria-label={
                                collapsed.has(account.code)
                                  ? `Buka ${account.name}`
                                  : `Tutup ${account.name}`
                              }
                              aria-expanded={!collapsed.has(account.code)}
                              className="-ml-1 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-white/70 dark:hover:bg-white/10"
                            >
                              {collapsed.has(account.code) ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span
                              aria-hidden
                              className="ml-2 mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/45"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <span
                                className={cn(
                                  "min-w-0 break-words",
                                  isHeader ? "font-semibold uppercase" : "",
                                )}
                              >
                                {account.name}
                              </span>
                              <span className="shrink-0 rounded bg-slate-950/5 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted dark:bg-white/8">
                                {formatCode(account.code)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted">
                              Level {account.level + 1}
                              {account.childCount > 0
                                ? ` · ${account.childCount} anak`
                                : " · akun posting"}
                            </div>
                          </div>
                        </div>

                        <div className="coa-field coa-field-group flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted coa-inline-label">
                            Grup
                          </span>
                          <span
                            className={cn(
                              BADGE,
                              groupTone(account.groupCode),
                              "lg:justify-self-start",
                            )}
                          >
                            {groupLabel(account.groupCode)}
                          </span>
                        </div>

                        <div className="coa-field coa-field-balance flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted coa-inline-label">
                            Saldo normal
                          </span>
                          <span
                            className={cn(
                              BADGE,
                              account.normalBalance === "DEBIT"
                                ? "bg-success/12 text-success"
                                : "bg-danger/12 text-danger",
                              "lg:justify-self-start",
                            )}
                          >
                            {NORMAL_BALANCE_LABEL[account.normalBalance] ?? account.normalBalance}
                          </span>
                        </div>

                        <div className="coa-field coa-field-status flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-muted coa-inline-label">
                            Status
                          </span>
                          <span
                            className={cn(
                              BADGE,
                              account.isActive
                                ? "bg-success/12 text-success"
                                : "bg-danger/12 text-danger",
                            )}
                          >
                            {account.isActive ? "Aktif" : "Nonaktif"}
                          </span>
                          <span
                            className={cn(
                              BADGE,
                              account.isPostingAllowed
                                ? "bg-accent/12 text-accent"
                                : "bg-slate-950/5 text-muted dark:bg-white/8",
                            )}
                          >
                            {account.isPostingAllowed ? "Posting" : "Header"}
                          </span>
                        </div>

                        <div className="coa-actions coa-field mt-1 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditing({
                                id: account.id,
                                name: account.name,
                                isActive: account.isActive,
                                code: account.code,
                                isSystem: account.isSystem,
                                childCount: account.childCount,
                              })
                            }
                            className={cn(ACTION, "coa-action-btn")}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={account.isSystem}
                            onClick={() =>
                              void requestAccount(
                                `/api/accounting/chart-of-accounts/${account.id}`,
                                "PATCH",
                                { isActive: !account.isActive },
                              )
                            }
                            className={cn(
                              ACTION,
                              "coa-action-btn coa-action-btn-wide whitespace-nowrap text-muted",
                            )}
                          >
                            {account.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            disabled={account.isSystem}
                            onClick={() =>
                              setPendingDelete({ id: account.id, name: account.name })
                            }
                            aria-label={`Hapus ${account.name}`}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-danger/40 text-danger transition hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        {pendingDelete?.id === account.id ? (
                          <div role="alertdialog" aria-label={`Konfirmasi hapus ${account.name}`} className="coa-field mt-2 grid gap-2 rounded-md border border-danger/30 bg-danger/5 p-3">
                            <p className="text-sm">
                              Hapus akun {account.code} {account.name}? Akun yang dihapus tidak bisa dikembalikan. Bila akun sudah dipakai di jurnal, pilih Nonaktifkan saja.
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const target = pendingDelete;
                                  setPendingDelete(null);
                                  requestAccount(`/api/accounting/chart-of-accounts/${target.id}`, "DELETE")
                                    .then(() => toast.success(`Akun ${target.name} dihapus.`))
                                    .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Gagal menghapus akun."));
                                }}
                                className="h-9 rounded-md bg-danger px-4 text-sm font-medium text-white"
                              >
                                Ya, hapus
                              </button>
                              <button type="button" onClick={() => setPendingDelete(null)} className="h-9 rounded-md border border-border px-4 text-sm">
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </GlassPanel>
        }
        side={
          <>
            <GlassPanel>
              <ManagedForm<CoaForm>
                key={editing?.id ?? "new"}
                schema={schema}
                defaultValues={
                  editing
                    ? {
                        code: editing.code,
                        name: editing.name,
                        groupCode: "ASSET",
                        normalBalance: "DEBIT",
                        parentCode: "",
                        isPostingAllowed:
                          editing.childCount > 0 ? "false" : "true",
                      }
                    : {
                        code: "",
                        name: "",
                        groupCode: "ASSET",
                        normalBalance: "DEBIT",
                        parentCode: "",
                        isPostingAllowed: "true",
                      }
                }
                onSubmit={async (values) => {
                  if (editing) {
                    await requestAccount(
                      `/api/accounting/chart-of-accounts/${editing.id}`,
                      "PATCH",
                      { name: values.name, isActive: editing.isActive },
                    );
                    setEditing(null);
                  } else {
                    await mutation.mutateAsync({
                      ...values,
                      parentCode: values.parentCode || undefined,
                      isPostingAllowed: values.isPostingAllowed === "true",
                    });
                    await accountsQuery.refetch?.();
                  }
                }}
              >
                {({ form }) => (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-base font-semibold">
                        {editing ? "Edit akun" : "Tambah akun"}
                      </h2>
                      {editing ? (
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="h-9 rounded-md border border-border px-3 text-xs text-muted"
                        >
                          Batal
                        </button>
                      ) : null}
                    </div>
                    <CoaFormFields
                      form={form}
                      rows={allRows}
                      editing={editing}
                    />
                  </>
                )}
              </ManagedForm>
            </GlassPanel>
            <DetailPanel title="Aturan kode">
              Kode diawali digit grup: Aset=1, Liabilitas=2, Ekuitas=3,
              Pendapatan=4, HPP=5, Beban=6, Beban lain=7. Akun header
              mengelompokkan; akun posting dipakai saat jurnal.
            </DetailPanel>
          </>
        }
      />
    </div>
  );
}
