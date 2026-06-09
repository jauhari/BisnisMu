"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { ManagedForm, RhfTextField, RhfDataSelect, type ManagedFormRenderProps, type SelectOption } from "@/components/forms/rhf-form";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassInput } from "@/components/forms/glass-form";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ code: z.string().regex(/^[1-7]\d{5}$/, "6 digit, awali 1-7"), name: z.string().min(3), groupCode: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "COGS", "EXPENSE", "OTHER_EXPENSE"]), normalBalance: z.enum(["DEBIT", "CREDIT"]), parentCode: z.string().optional(), isPostingAllowed: z.enum(["true", "false"]) });
type CoaForm = z.infer<typeof schema>;

type AccountNode = { id: string; code: string; name: string; groupCode: number | string; normalBalance: "DEBIT" | "CREDIT"; parentCode?: string | null; isActive: boolean; isSystem: boolean; isPostingAllowed?: boolean; children?: AccountNode[] };
type TreeRow = AccountNode & { level: number; childCount: number };
type EditingAccount = Pick<TreeRow, "id" | "name" | "isActive" | "code" | "isSystem" | "childCount">;
type GroupCode = CoaForm["groupCode"];

const GROUP_OPTIONS: SelectOption[] = [{ value: "ASSET", label: "1 - Aset (DEBIT)" }, { value: "LIABILITY", label: "2 - Liabilitas (CREDIT)" }, { value: "EQUITY", label: "3 - Ekuitas (CREDIT)" }, { value: "REVENUE", label: "4 - Pendapatan (CREDIT)" }, { value: "COGS", label: "5 - HPP (DEBIT)" }, { value: "EXPENSE", label: "6 - Beban (DEBIT)" }, { value: "OTHER_EXPENSE", label: "7 - Beban lain (DEBIT)" }];
const GROUP_LABELS: Record<string, string> = { "1": "Aset", "2": "Liabilitas", "3": "Ekuitas", "4": "Pendapatan", "5": "HPP", "6": "Beban", "7": "Beban lain", ASSET: "Aset", LIABILITY: "Liabilitas", EQUITY: "Ekuitas", REVENUE: "Pendapatan", COGS: "HPP", EXPENSE: "Beban", OTHER_EXPENSE: "Beban lain" };
const GROUP_TONE: Record<string, string> = { "1": "bg-success/10 text-success", "2": "bg-warning/12 text-warning", "3": "bg-accent/10 text-accent", "4": "bg-success/10 text-success", "5": "bg-danger/10 text-danger", "6": "bg-danger/10 text-danger", "7": "bg-danger/10 text-danger" };
const GROUP_DIGIT: Record<GroupCode, string> = { ASSET: "1", LIABILITY: "2", EQUITY: "3", REVENUE: "4", COGS: "5", EXPENSE: "6", OTHER_EXPENSE: "7" };
const GROUP_NORMAL: Record<GroupCode, "DEBIT" | "CREDIT"> = { ASSET: "DEBIT", LIABILITY: "CREDIT", EQUITY: "CREDIT", REVENUE: "CREDIT", COGS: "DEBIT", EXPENSE: "DEBIT", OTHER_EXPENSE: "DEBIT" };

function flattenTree(nodes: AccountNode[], level = 0): TreeRow[] {
  return nodes.flatMap((node) => [{ ...node, level, childCount: node.children?.length ?? 0 }, ...flattenTree(node.children ?? [], level + 1)]);
}
function groupKey(groupCode: number | string) { return String(groupCode).replace(/\D/g, "") || String(groupCode); }
function groupLabel(groupCode: number | string) { return GROUP_LABELS[String(groupCode)] ?? GROUP_LABELS[groupKey(groupCode)] ?? `Grup ${groupCode}`; }
function groupTone(groupCode: number | string) { return GROUP_TONE[groupKey(groupCode)] ?? "bg-slate-950/5 text-muted"; }
function stats(rows: TreeRow[]) {
  return { total: rows.length, parent: rows.filter((r) => r.childCount > 0).length, posting: rows.filter((r) => r.isPostingAllowed).length };
}

function nextAccountCode(rows: TreeRow[], groupCode: GroupCode, parentCode?: string) {
  const digit = GROUP_DIGIT[groupCode];
  const parent = parentCode ? rows.find((row) => row.code === parentCode) : null;
  const siblings = rows.filter((row) => (parentCode ? row.parentCode === parentCode : !row.parentCode && row.code.startsWith(digit)) && /^\d{6}$/.test(row.code));
  const step = parent ? (parent.level === 0 ? 100 : 1) : 10000;
  const base = parent ? Number(parent.code) : Number(`${digit}00000`);
  const max = siblings.reduce((current, row) => Math.max(current, Number(row.code)), base);
  return String(max + step).padStart(6, "0");
}
function CoaFormFields({ form, rows, editing }: { form: ManagedFormRenderProps<CoaForm>["form"]; rows: TreeRow[]; editing: EditingAccount | null }) {
  const groupCode = form.watch("groupCode");
  const parentCode = form.watch("parentCode");
  const isPostingAllowed = form.watch("isPostingAllowed");
  const parentOptions = rows.filter((row) => row.code.startsWith(GROUP_DIGIT[groupCode]) && !row.isPostingAllowed).map((row) => ({ value: row.code, label: `${"  ".repeat(row.level)}${row.name} (${row.code})` }));
  useEffect(() => {
    if (editing) return;
    form.setValue("code", nextAccountCode(rows, groupCode, parentCode || undefined), { shouldDirty: true, shouldValidate: true });
    form.setValue("normalBalance", GROUP_NORMAL[groupCode], { shouldDirty: true, shouldValidate: true });
  }, [editing, form, groupCode, parentCode, rows]);
  return <div className="grid gap-4"><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Kode akun</span><GlassInput value={form.watch("code")} readOnly className="h-11 bg-slate-950/5 text-muted" /></label><RhfTextField<CoaForm> name="name" label="Nama akun" placeholder="Bank BRI / Kas Operasional" /><RhfDataSelect<CoaForm> name="groupCode" label="Grup" options={GROUP_OPTIONS} placeholder="Pilih grup" loading={Boolean(editing)} /><RhfDataSelect<CoaForm> name="parentCode" label="Induk akun" options={[{ value: "", label: "Tanpa induk" }, ...parentOptions]} placeholder="Pilih induk akun" loading={Boolean(editing)} /><RhfDataSelect<CoaForm> name="isPostingAllowed" label="Tipe akun" options={[{ value: "false", label: "Header / kategori" }, { value: "true", label: "Posting / dipakai jurnal" }]} placeholder="Pilih tipe akun" loading={Boolean(editing)} /><div className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Saldo normal</span><div className="rounded-md border border-border bg-slate-950/5 px-3 py-2.5 text-sm font-medium text-muted dark:bg-white/8">{form.watch("normalBalance")}</div><p className="text-xs leading-5 text-muted">Otomatis dari grup akun. Aset/Beban normalnya DEBIT; Liabilitas/Ekuitas/Pendapatan normalnya CREDIT.</p></div><p className="text-xs leading-5 text-muted">{isPostingAllowed === "false" ? "Header dipakai untuk membuat kategori seperti Kas atau Bank." : "Akun posting dipakai untuk transaksi jurnal."} Kode otomatis mengikuti induk dan nomor terakhir.</p><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">{editing ? "Simpan perubahan" : "Simpan akun"}</button></div>;
}
export default function Page() {
  const mutation = usePostMutation("/api/accounting/chart-of-accounts");
  const seed = usePostMutation("/api/accounting/chart-of-accounts/seed");
  const [editing, setEditing] = useState<EditingAccount | null>(null);
  const accountsQuery = useListQuery<AccountNode[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const { data, isLoading, error } = accountsQuery;
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Accounts unavailable" description="Unable to load chart of accounts." />;
  const rows = flattenTree(data.data ?? []);
  const summary = stats(rows);
  async function requestAccount(path: string, method: string, body?: unknown) {
    const init: RequestInit = { method };
    if (body !== undefined) { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(body); }
    const response = await fetch(path, init);
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(json?.message ?? json?.error?.message ?? "Aksi akun gagal.");
    await accountsQuery.refetch?.();
    return json;
  }

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Accounting" title="Bagan Akun" description="Hierarki akun SAK EMKM untuk pencatatan jurnal dan laporan." action={rows.length === 0 ? <button onClick={() => seed.mutate({})} className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background">Buat akun SAK EMKM</button> : undefined} /><SplitWorkspace main={<GlassPanel className="p-0"><div className="grid gap-4 border-b border-border/70 bg-white/35 px-5 py-4 dark:bg-white/5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Hierarki akun</h2><p className="mt-1 text-sm text-muted">Akun header mengelompokkan buku besar; akun posting dipakai untuk baris jurnal.</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-slate-950/5 px-2.5 py-1 text-muted">{summary.total} akun</span><span className="rounded-md bg-accent/10 px-2.5 py-1 text-accent">{summary.parent} parent</span><span className="rounded-md bg-success/10 px-2.5 py-1 text-success">{summary.posting} posting</span></div></div></div><div className="max-h-[660px] overflow-auto"><table className="w-full border-separate border-spacing-0 text-sm"><thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_hsl(var(--border))] backdrop-blur dark:bg-slate-950/95"><tr><th className="border-b border-r border-border/70 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Akun</th><th className="w-36 border-b border-r border-border/70 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Grup</th><th className="w-36 border-b border-r border-border/70 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Saldo normal</th><th className="w-32 border-b border-r border-border/70 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Status</th><th className="w-36 border-b border-border/70 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Aksi</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">Belum ada akun. Gunakan tombol Buat akun SAK EMKM.</td></tr> : rows.map((account, index) => { const isHeader = !account.isPostingAllowed; return <tr key={account.id ?? account.code} className={isHeader ? "bg-accent/8 shadow-[inset_4px_0_0_hsl(var(--accent)/0.55)] transition-colors hover:bg-accent/12 dark:bg-accent/12 dark:hover:bg-accent/16" : `${index % 2 === 0 ? "bg-white/55 dark:bg-white/[0.035]" : "bg-slate-50/70 dark:bg-white/[0.02]"} transition-colors hover:bg-accent/7 dark:hover:bg-accent/10`}><td className="border-b border-r border-border/60 px-4 py-3"><div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: account.level * 24 }}><span className={account.childCount > 0 ? "h-2.5 w-2.5 rounded-sm border border-accent/45 bg-accent/15" : "h-2.5 w-2.5 rounded-full bg-muted/45"} /><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center justify-between gap-3"><span className={account.childCount > 0 ? "truncate font-semibold uppercase text-foreground" : "truncate text-foreground"}>{account.name}</span><span className="shrink-0 rounded bg-slate-950/5 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted dark:bg-white/8">{account.code}</span></div><div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><span>Level {account.level + 1}</span>{account.childCount > 0 ? <span>{account.childCount} anak</span> : <span>Akun posting</span>}</div></div></div></td><td className="border-b border-r border-border/60 px-4 py-3"><span className={`rounded-md px-2 py-1 text-xs font-medium ${groupTone(account.groupCode)}`}>{groupLabel(account.groupCode)}</span></td><td className="border-b border-r border-border/60 px-4 py-3"><span className={account.normalBalance === "DEBIT" ? "rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success" : "rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger"}>{account.normalBalance}</span></td><td className="border-b border-r border-border/60 px-4 py-3"><div className="flex flex-wrap gap-1.5">{account.isActive ? <span className="rounded-md bg-success/10 px-2 py-1 text-xs font-medium text-success">Aktif</span> : <span className="rounded-md bg-danger/10 px-2 py-1 text-xs font-medium text-danger">Nonaktif</span>}{account.isPostingAllowed ? <span className="rounded-md bg-accent/10 px-2 py-1 text-xs font-medium text-accent">Posting</span> : <span className="rounded-md bg-slate-950/5 px-2 py-1 text-xs font-medium text-muted">Header</span>}</div></td><td className="border-b border-border/60 px-4 py-3"><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setEditing({ id: account.id, name: account.name, isActive: account.isActive, code: account.code, isSystem: account.isSystem, childCount: account.childCount })} className="rounded border border-border px-2 py-1 text-xs">Edit</button><button type="button" disabled={account.isSystem} onClick={() => void requestAccount(`/api/accounting/chart-of-accounts/${account.id}`, "PATCH", { isActive: !account.isActive })} className="rounded border border-border px-2 py-1 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-40">{account.isActive ? "Nonaktif" : "Aktifkan"}</button><button type="button" disabled={account.isSystem} onClick={() => void requestAccount(`/api/accounting/chart-of-accounts/${account.id}`, "DELETE")} className="rounded border border-danger/35 px-2 py-1 text-xs text-danger disabled:cursor-not-allowed disabled:opacity-40">Hapus</button></div></td></tr>; })}</tbody></table></div></GlassPanel>} side={<><GlassPanel><ManagedForm<CoaForm> key={editing?.id ?? "new"} schema={schema} defaultValues={editing ? { code: editing.code, name: editing.name, groupCode: "ASSET", normalBalance: "DEBIT", parentCode: "", isPostingAllowed: editing.childCount > 0 ? "false" : "true" } : { code: "", name: "", groupCode: "ASSET", normalBalance: "DEBIT", parentCode: "", isPostingAllowed: "true" }} onSubmit={async (values) => { if (editing) { await requestAccount(`/api/accounting/chart-of-accounts/${editing.id}`, "PATCH", { name: values.name, isActive: editing.isActive }); setEditing(null); } else { await mutation.mutateAsync({ ...values, parentCode: values.parentCode || undefined, isPostingAllowed: values.isPostingAllowed === "true" }); await accountsQuery.refetch?.(); } }}>{({ form }) => <><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">{editing ? "Edit akun" : "Tambah akun"}</h2>{editing ? <button type="button" onClick={() => setEditing(null)} className="rounded border border-border px-3 py-1.5 text-xs text-muted">Batal</button> : null}</div><CoaFormFields form={form} rows={rows} editing={editing} /></>}</ManagedForm></GlassPanel><DetailPanel title="Aturan">Kode harus diawali digit grup: Aset=1, Liabilitas=2, Ekuitas=3, Pendapatan=4, HPP=5, Beban=6, Beban lain=7. Akun header mengelompokkan; akun posting dipakai saat jurnal.</DetailPanel></>} /></div>;
}