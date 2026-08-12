"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, CheckCircle2, CircleDollarSign, Landmark, Pencil, Plus, Trash2, UserRoundPlus, UsersRound, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { MoneyField } from "@/components/forms/financial-inputs";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

type EmployeeRole = "DOCTOR" | "NURSE" | "STAFF" | "OTHER";
type PayrollStatus = "DRAFT" | "APPROVED" | "PAID";

interface Employee { id: string; name: string; role: EmployeeRole; isActive: boolean; }
interface Account { id: string; code: string; name: string; groupCode: number; subtype?: string | null; isPostingAllowed: boolean; isActive: boolean; children?: Account[]; }
type PayrollItemPaymentStatus = "UNPAID" | "PARTIAL" | "PAID";
interface PayrollItem { id?: string; employeeId: string; employeeName: string; employeeRole: EmployeeRole; salaryAmount: string; incentiveAmount: string; deductionAmount: string; grossAmount: string; netAmount: string; paidAmount: string; paymentStatus: PayrollItemPaymentStatus; notes?: string | null; }
interface PayrollRun { id: string; period: string; status: PayrollStatus; expenseAccountId: string; payableAccountId: string; deductionPayableAccountId?: string | null; totalGrossAmount: string; totalDeductionAmount: string; totalNetAmount: string; items: PayrollItem[]; }
interface DraftItem { employeeId: string; salaryAmount: string; incentiveAmount: string; deductionAmount: string; notes: string; }
interface PayrollDashboard { totalAccruedAmount: string; totalPaidAmount: string; totalOutstandingAmount: string; pendingApprovalCount: number; currentPeriod: PayrollRun | null; employeeBalances: Array<{ employeeId: string; employeeName: string; employeeRole: EmployeeRole; outstandingAmount: string }>; }

const ROLE_LABEL: Record<EmployeeRole, string> = { DOCTOR: "Dokter", NURSE: "Perawat", STAFF: "Staf", OTHER: "Lainnya" };
const ROLE_TONE: Record<EmployeeRole, string> = { DOCTOR: "bg-violet-500/10 text-violet-700 dark:text-violet-300", NURSE: "bg-teal-500/10 text-teal-700 dark:text-teal-300", STAFF: "bg-amber-500/10 text-amber-700 dark:text-amber-300", OTHER: "bg-slate-950/5 text-muted dark:bg-white/8" };
const STATUS_LABEL: Record<PayrollStatus, string> = { DRAFT: "Draft", APPROVED: "Disetujui", PAID: "Dibayar" };
const STATUS_TONE: Record<PayrollStatus, string> = { DRAFT: "bg-amber-500/10 text-amber-700 dark:text-amber-300", APPROVED: "bg-accent/10 text-accent", PAID: "bg-success/10 text-success" };
const PAYMENT_STATUS_LABEL: Record<PayrollItemPaymentStatus, string> = { UNPAID: "Belum dibayar", PARTIAL: "Sebagian", PAID: "Lunas" };
const PAYMENT_STATUS_TONE: Record<PayrollItemPaymentStatus, string> = { UNPAID: "bg-amber-500/10 text-amber-700 dark:text-amber-300", PARTIAL: "bg-accent/10 text-accent", PAID: "bg-success/10 text-success" };
const roleOptions = (Object.keys(ROLE_LABEL) as EmployeeRole[]).map((role) => ({ value: role, label: ROLE_LABEL[role] }));

function flatten(nodes: Account[]): Account[] { return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]); }
function idr(value: string | number | bigint): string { return `Rp ${BigInt(value || 0).toLocaleString("id-ID")}`; }
function firstDayOfMonth(): string { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10); }
function todayDate(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function numberOf(value: string): bigint { return BigInt(value || "0"); }
function preferredExpenseAccount(accounts: Account[]): Account | undefined { return accounts.find((account) => account.subtype === "salary_expense" || account.code === "610101") ?? accounts[0]; }
function preferredPayableAccount(accounts: Account[]): Account | undefined { return accounts.find((account) => account.subtype === "salary_payable" || account.code === "210501") ?? accounts[0]; }

async function requestJson(path: string, method: string, body?: unknown) {
  const init: RequestInit = { method, credentials: "include" };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.message ?? json?.error?.message ?? "Aksi gagal.");
  return json;
}

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const employeesQuery = useListQuery<Employee[]>("/api/payroll/employees", ["list", "payroll-employees"]);
  const payrollQuery = useListQuery<PayrollRun[]>("/api/payroll/runs", ["list", "payroll-runs"]);
  const dashboardQuery = useListQuery<PayrollDashboard>("/api/payroll/dashboard", ["detail", "payroll-dashboard"]);
  const accountsQuery = useListQuery<Account[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole>("DOCTOR");
  const [employeeIsActive, setEmployeeIsActive] = useState(true);
  const [creatingRun, setCreatingRun] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: "employee" | "run"; id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentAccountIds, setPaymentAccountIds] = useState<Record<string, string>>({});
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ period: firstDayOfMonth(), expenseAccountId: "", payableAccountId: "", deductionPayableAccountId: "", items: [] as DraftItem[] });

  const employees = employeesQuery.data?.data ?? [];
  const runs = payrollQuery.data?.data ?? [];
  const dashboard = dashboardQuery.data?.data;
  const accounts = useMemo(() => flatten(accountsQuery.data?.data ?? []), [accountsQuery.data]);
  const postingAccounts = useMemo(() => accounts.filter((account) => account.isPostingAllowed && account.isActive), [accounts]);
  const expenseAccounts = useMemo(() => postingAccounts.filter((account) => account.groupCode === 6), [postingAccounts]);
  const liabilityAccounts = useMemo(() => postingAccounts.filter((account) => account.groupCode === 2), [postingAccounts]);
  const cashAccounts = useMemo(() => postingAccounts.filter((account) => {
    const subtype = account.subtype?.toLowerCase();
    return subtype === "cash" || subtype === "bank" || account.groupCode === 1;
  }), [postingAccounts]);
  const activeEmployees = employees.filter((employee) => employee.isActive);

  const accountOptions = (items: Account[]) => items.map((account) => ({ value: account.id, label: account.name, code: account.code, name: account.name }));
  const total = useMemo(() => draft.items.reduce((sum, item) => sum + numberOf(item.salaryAmount) + numberOf(item.incentiveAmount) - numberOf(item.deductionAmount), 0n), [draft.items]);

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      expenseAccountId: current.expenseAccountId || preferredExpenseAccount(expenseAccounts)?.id || "",
      payableAccountId: current.payableAccountId || preferredPayableAccount(liabilityAccounts)?.id || "",
    }));
  }, [expenseAccounts, liabilityAccounts]);

  if (employeesQuery.isLoading || payrollQuery.isLoading || accountsQuery.isLoading) return <GlassSkeleton className="h-80" />;

  function refresh() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ["list", "payroll-employees"] }),
      queryClient.invalidateQueries({ queryKey: ["list", "payroll-runs"] }),
      queryClient.invalidateQueries({ queryKey: ["detail", "payroll-dashboard"] }),
    ]);
  }

  function startRun() {
    setEditingRunId(null);
    setDraft({
      period: firstDayOfMonth(),
      expenseAccountId: preferredExpenseAccount(expenseAccounts)?.id ?? "",
      payableAccountId: preferredPayableAccount(liabilityAccounts)?.id ?? "",
      deductionPayableAccountId: "",
      items: activeEmployees.map((employee) => ({ employeeId: employee.id, salaryAmount: "", incentiveAmount: "", deductionAmount: "", notes: "" })),
    });
    setCreatingRun(true);
  }

  function editRun(run: PayrollRun) {
    setEditingRunId(run.id);
    setDraft({ period: run.period.slice(0, 10), expenseAccountId: run.expenseAccountId, payableAccountId: run.payableAccountId, deductionPayableAccountId: run.deductionPayableAccountId ?? "", items: run.items.map((item) => ({ employeeId: item.employeeId, salaryAmount: item.salaryAmount, incentiveAmount: item.incentiveAmount, deductionAmount: item.deductionAmount, notes: item.notes ?? "" })) });
    setCreatingRun(true);
  }

  function editEmployee(employee: Employee) {
    setEditingEmployeeId(employee.id);
    setEmployeeName(employee.name);
    setEmployeeRole(employee.role);
    setEmployeeIsActive(employee.isActive);
    setAddingEmployee(true);
  }

  function updateItem(employeeId: string, patch: Partial<DraftItem>) {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.employeeId === employeeId ? { ...item, ...patch } : item) }));
  }

  async function saveEmployee() {
    if (!employeeName.trim()) return;
    setBusy(true);
    try {
      if (editingEmployeeId) await requestJson(`/api/payroll/employees/${editingEmployeeId}`, "PATCH", { name: employeeName.trim(), role: employeeRole, isActive: employeeIsActive });
      else await requestJson("/api/payroll/employees", "POST", { name: employeeName.trim(), role: employeeRole });
      setEmployeeName("");
      setEditingEmployeeId(null);
      setEmployeeIsActive(true);
      setAddingEmployee(false);
      await refresh();
      toast.success(editingEmployeeId ? "Karyawan diperbarui." : "Karyawan ditambahkan.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menambah karyawan.");
    } finally { setBusy(false); }
  }

  async function createRun() {
    if (!draft.expenseAccountId || !draft.payableAccountId) { toast.error("Pilih akun beban dan utang gaji."); return; }
    if (!draft.items.length) { toast.error("Tambahkan minimal satu karyawan."); return; }
    setBusy(true);
    try {
      await requestJson(editingRunId ? `/api/payroll/runs/${editingRunId}` : "/api/payroll/runs", editingRunId ? "PATCH" : "POST", {
        ...draft,
        deductionPayableAccountId: draft.deductionPayableAccountId || undefined,
        items: draft.items.map((item) => ({ ...item, notes: item.notes || undefined })),
      });
      setCreatingRun(false);
      setEditingRunId(null);
      await refresh();
      toast.success(editingRunId ? "Payroll draft diperbarui." : "Payroll draft dibuat.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal membuat payroll.");
    } finally { setBusy(false); }
  }

  async function deleteEntity() {
    if (!deleteConfirm) return;
    setBusy(true);
    try {
      const path = deleteConfirm.kind === "employee" ? `/api/payroll/employees/${deleteConfirm.id}` : `/api/payroll/runs/${deleteConfirm.id}`;
      await requestJson(path, "DELETE");
      setDeleteConfirm(null);
      await refresh();
      toast.success(deleteConfirm.kind === "employee" ? "Karyawan dihapus." : "Payroll draft dihapus.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus data."); }
    finally { setBusy(false); }
  }

  async function toggleEmployee(employee: Employee) {
    setBusy(true);
    try {
      await requestJson(`/api/payroll/employees/${employee.id}`, "PATCH", { name: employee.name, role: employee.role, isActive: !employee.isActive });
      await refresh();
      toast.success(employee.isActive ? "Karyawan dinonaktifkan." : "Karyawan diaktifkan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mengubah status karyawan."); }
    finally { setBusy(false); }
  }

  async function approveRun(run: PayrollRun) {
    setBusy(true);
    try {
      await requestJson(`/api/payroll/runs/${run.id}/approve`, "POST", { approvedAt: `${run.period.slice(0, 7)}-28` });
      await refresh();
      toast.success("Payroll disetujui dan jurnal akrual dibuat.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyetujui payroll."); }
    finally { setBusy(false); }
  }

  async function payItem(run: PayrollRun, item: PayrollItem) {
    const key = `${run.id}:${item.employeeId}`;
    const paymentAccountId = paymentAccountIds[key];
    if (!paymentAccountId) { toast.error("Pilih sumber pembayaran untuk karyawan ini."); return; }
    const paidAt = paymentDates[key] ?? todayDate();
    const remaining = numberOf(item.netAmount) - numberOf(item.paidAmount);
    const amount = numberOf(paymentAmounts[key] ?? remaining.toString());
    if (amount <= 0n) { toast.error("Masukkan nominal pembayaran."); return; }
    if (amount > remaining) { toast.error("Nominal melebihi sisa utang gaji."); return; }
    setBusy(true);
    try {
      await requestJson(`/api/payroll/runs/${run.id}/items/${item.employeeId}/pay`, "POST", { paymentAccountId, amount: amount.toString(), paidAt });
      setPaymentAmounts((current) => ({ ...current, [key]: "" }));
      await refresh();
      toast.success(`Pembayaran ${item.employeeName} dicatat.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal mencatat pembayaran."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto grid w-full max-w-[1440px] min-w-0 gap-5 pb-8">
    <WorkspaceHeader eyebrow="Keuangan" title="Penggajian" description="Tentukan kewajiban gaji bulanan, lalu selesaikan pembayaran per karyawan melalui kas atau bank." action={<button type="button" onClick={startRun} disabled={!activeEmployees.length} className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background shadow-sm transition duration-200 hover:bg-foreground/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />Buat payroll</button>} />

    <GlassPanel className="overflow-hidden p-0">
      <div className="grid grid-cols-2 divide-x divide-y divide-border/70 sm:grid-cols-4 sm:divide-y-0">
        <div className="min-w-0 px-4 py-4 sm:px-5"><p className="text-xs font-medium text-muted">Kewajiban disetujui</p><p className="mt-1.5 truncate text-lg font-semibold tabular-nums sm:text-xl">{idr(dashboard?.totalAccruedAmount ?? "0")}</p></div>
        <div className="min-w-0 px-4 py-4 sm:px-5"><p className="text-xs font-medium text-muted">Sudah dibayar</p><p className="mt-1.5 truncate text-lg font-semibold tabular-nums text-success sm:text-xl">{idr(dashboard?.totalPaidAmount ?? "0")}</p></div>
        <div className="min-w-0 px-4 py-4 sm:px-5"><p className="text-xs font-medium text-muted">Sisa utang gaji</p><p className="mt-1.5 truncate text-lg font-semibold tabular-nums text-accent sm:text-xl">{idr(dashboard?.totalOutstandingAmount ?? "0")}</p></div>
        <div className="min-w-0 px-4 py-4 sm:px-5"><p className="text-xs font-medium text-muted">Menunggu persetujuan</p><p className="mt-1.5 text-lg font-semibold tabular-nums sm:text-xl">{dashboard?.pendingApprovalCount ?? 0}<span className="ml-1 text-sm font-medium text-muted">draft</span></p></div>
      </div>
    </GlassPanel>

    {dashboard?.employeeBalances.length ? <GlassPanel className="grid gap-3 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Utang gaji per karyawan</h2><p className="mt-1 text-xs text-muted">Akumulasi dari payroll yang sudah disetujui.</p></div><span className="text-xs font-medium text-muted">{dashboard.employeeBalances.length} orang</span></div><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{dashboard.employeeBalances.map((balance) => <div key={balance.employeeId} className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{balance.employeeName}</p><p className="mt-0.5 text-xs text-muted">{ROLE_LABEL[balance.employeeRole]}</p></div><p className="shrink-0 text-sm font-semibold tabular-nums text-accent">{idr(balance.outstandingAmount)}</p></div>)}</div></GlassPanel> : null}

    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <aside className="order-2 min-w-0 self-start xl:col-start-2 xl:row-start-1">
        <GlassPanel className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">Tim payroll</p><p className="mt-1 text-xs leading-5 text-muted">{activeEmployees.length} aktif dari {employees.length} karyawan</p></div><div className="grid h-9 w-9 place-items-center rounded-md bg-accent/10 text-accent"><UsersRound className="h-4 w-4" /></div></div>
          {addingEmployee ? <div className="grid gap-2 border-t border-border/70 pt-3"><GlassInput value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} placeholder="Nama karyawan" className="h-11" autoFocus /><GlassDataSelect value={employeeRole} onChange={(value) => setEmployeeRole(value as EmployeeRole)} options={roleOptions} className="h-11" />{editingEmployeeId ? <button type="button" role="switch" aria-checked={employeeIsActive} onClick={() => setEmployeeIsActive((current) => !current)} className="flex h-11 items-center justify-between rounded-md border border-border bg-white/60 px-3 text-sm font-medium transition duration-200 hover:bg-foreground/[0.04] dark:bg-white/8"><span>Status karyawan</span><span className="flex items-center gap-2"><span className={employeeIsActive ? "text-success" : "text-muted"}>{employeeIsActive ? "Aktif" : "Nonaktif"}</span><span className={`relative h-5 w-9 rounded-full transition-colors ${employeeIsActive ? "bg-success" : "bg-muted/45"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${employeeIsActive ? "translate-x-4" : "translate-x-0.5"}`} /></span></span></button> : null}<div className="flex gap-2"><button type="button" onClick={() => void saveEmployee()} disabled={busy || !employeeName.trim()} className="h-10 rounded-md bg-foreground px-3 text-xs font-semibold text-background transition duration-200 active:translate-y-px disabled:opacity-50">Simpan</button><button type="button" onClick={() => { setAddingEmployee(false); setEditingEmployeeId(null); setEmployeeName(""); setEmployeeIsActive(true); }} className="h-10 rounded-md border border-border px-3 text-xs font-medium transition duration-200 hover:bg-foreground/[0.04]">Batal</button></div></div> : <button type="button" onClick={() => { setEditingEmployeeId(null); setEmployeeName(""); setEmployeeRole("DOCTOR"); setEmployeeIsActive(true); setAddingEmployee(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-dashed border-accent/45 text-sm font-medium text-accent transition duration-200 hover:bg-accent/8 active:translate-y-px"><UserRoundPlus className="h-4 w-4" />Tambah karyawan</button>}
          {employees.length === 0 ? <p className="border-t border-border/70 pt-3 text-sm leading-6 text-muted">Tambahkan Dokter, Perawat, atau Staf untuk mulai membuat payroll.</p> : <div className="grid border-t border-border/70 pt-2">{employees.map((employee) => <div key={employee.id} className="flex min-h-14 items-center justify-between gap-2 rounded-md px-2 py-2 transition duration-200 hover:bg-foreground/[0.035] dark:hover:bg-white/5"><div className="min-w-0"><p className={`truncate text-sm font-medium ${employee.isActive ? "" : "text-muted line-through"}`}>{employee.name}</p><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${ROLE_TONE[employee.role]}`}>{ROLE_LABEL[employee.role]}</span></div><div className="flex shrink-0 items-center gap-1"><div className="flex items-center gap-1.5"><span className={`text-[10px] font-medium ${employee.isActive ? "text-success" : "text-muted"}`}>{employee.isActive ? "Aktif" : "Nonaktif"}</span><button type="button" role="switch" aria-checked={employee.isActive} title={employee.isActive ? `Nonaktifkan ${employee.name}` : `Aktifkan ${employee.name}`} aria-label={employee.isActive ? `Nonaktifkan ${employee.name}` : `Aktifkan ${employee.name}`} disabled={busy} onClick={() => void toggleEmployee(employee)} className={`relative h-6 w-10 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${employee.isActive ? "bg-success" : "bg-muted/45"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${employee.isActive ? "translate-x-4.5" : "translate-x-0.5"}`} /></button></div><button type="button" title={`Edit ${employee.name}`} aria-label={`Edit ${employee.name}`} onClick={() => editEmployee(employee)} className="grid h-9 w-9 place-items-center rounded-md text-muted transition duration-200 hover:bg-foreground/8 hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button><button type="button" title={`Hapus ${employee.name}`} aria-label={`Hapus ${employee.name}`} onClick={() => setDeleteConfirm({ kind: "employee", id: employee.id, name: employee.name })} className="grid h-9 w-9 place-items-center rounded-md text-muted transition duration-200 hover:bg-danger/10 hover:text-danger"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div>}
        </GlassPanel>
      </aside>

      <main className="order-1 grid min-w-0 gap-5 xl:col-start-1 xl:row-start-1">
        {runs.length ? <GlassPanel className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] sm:items-end sm:p-5"><div><h2 className="text-sm font-semibold">Riwayat payroll</h2><p className="mt-1 text-xs leading-5 text-muted">Pilih satu periode untuk melihat kewajiban dan pembayaran per karyawan.</p></div><label className="grid gap-1.5 text-xs font-medium text-muted">Periode payroll<GlassDataSelect value={selectedRunId ?? runs[0]?.id ?? ""} onChange={setSelectedRunId} options={runs.map((run) => ({ value: run.id, label: `${new Date(run.period).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })} (${STATUS_LABEL[run.status]}) - ${idr(run.totalNetAmount)}` }))} className="h-11" /></label></GlassPanel> : null}
        {creatingRun ? <GlassPanel className="overflow-hidden border-accent/25 p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 bg-foreground/[0.025] px-5 py-4 sm:px-6"><div><div className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-md bg-accent/10 text-accent"><BadgeDollarSign className="h-4 w-4" /></span>{editingRunId ? "Edit payroll draft" : "Payroll baru"}</div><p className="mt-1.5 text-xs leading-5 text-muted">Nominal pada draft ini hanya berlaku untuk periode yang dipilih.</p></div><button type="button" onClick={() => { setCreatingRun(false); setEditingRunId(null); }} title="Tutup form payroll" aria-label="Tutup form payroll" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted transition hover:bg-foreground/5 hover:text-foreground"><X className="h-4 w-4" /></button></div>
          <div className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6">
            <section className="grid gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-accent" />Konfigurasi jurnal</div><div className="grid gap-3 md:grid-cols-3"><label className="grid gap-1.5 text-xs font-medium text-muted">Periode<GlassDatePicker value={draft.period} onChange={(value) => setDraft((current) => ({ ...current, period: value }))} className="h-11" /></label><label className="grid gap-1.5 text-xs font-medium text-muted">Beban gaji<GlassDataSelect value={draft.expenseAccountId} onChange={(value) => setDraft((current) => ({ ...current, expenseAccountId: value }))} options={accountOptions(expenseAccounts)} placeholder="Pilih beban gaji" className="h-11" /></label><label className="grid gap-1.5 text-xs font-medium text-muted">Utang gaji<GlassDataSelect value={draft.payableAccountId} onChange={(value) => setDraft((current) => ({ ...current, payableAccountId: value }))} options={accountOptions(liabilityAccounts)} placeholder="Pilih utang gaji" className="h-11" /></label></div><label className="grid max-w-md gap-1.5 text-xs font-medium text-muted">Utang potongan <span className="font-normal text-muted/75">(opsional)</span><GlassDataSelect value={draft.deductionPayableAccountId} onChange={(value) => setDraft((current) => ({ ...current, deductionPayableAccountId: value }))} options={accountOptions(liabilityAccounts)} placeholder="Pilih akun potongan" className="h-11" /></label></section>
            <section className="grid gap-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-sm font-semibold">Rincian nominal</p><p className="mt-1 text-xs text-muted">Masukkan nominal aktual untuk setiap karyawan.</p></div><p className="text-xs font-medium text-muted">{draft.items.length} karyawan</p></div><div className="overflow-x-auto rounded-md border border-border"><div className="min-w-[860px]"><div className="grid grid-cols-[minmax(220px,1.45fr)_repeat(4,minmax(130px,1fr))] gap-3 bg-foreground/[0.035] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted"><span>Karyawan</span><span className="text-right">Gaji</span><span className="text-right">Insentif</span><span className="text-right">Potongan</span><span className="text-right">Bersih</span></div><div className="divide-y divide-border/70">{draft.items.map((item) => { const employee = employees.find((person) => person.id === item.employeeId); const netAmount = numberOf(item.salaryAmount) + numberOf(item.incentiveAmount) - numberOf(item.deductionAmount); return <div key={item.employeeId} className="grid grid-cols-[minmax(220px,1.45fr)_repeat(4,minmax(130px,1fr))] items-center gap-3 px-4 py-3 transition hover:bg-foreground/[0.018]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{employee?.name}</p><span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${employee ? ROLE_TONE[employee.role] : ""}`}>{employee ? ROLE_LABEL[employee.role] : ""}</span></div><MoneyField prefix value={item.salaryAmount} onChange={(value) => updateItem(item.employeeId, { salaryAmount: value })} placeholder="0" className="h-11 w-full rounded-md border border-border bg-white/60 px-3 text-right text-sm tabular-nums shadow-sm transition focus:border-accent/60 focus:outline-none dark:bg-white/8" /><MoneyField prefix value={item.incentiveAmount} onChange={(value) => updateItem(item.employeeId, { incentiveAmount: value })} placeholder="0" className="h-11 w-full rounded-md border border-border bg-white/60 px-3 text-right text-sm tabular-nums shadow-sm transition focus:border-accent/60 focus:outline-none dark:bg-white/8" /><MoneyField prefix value={item.deductionAmount} onChange={(value) => updateItem(item.employeeId, { deductionAmount: value })} placeholder="0" className="h-11 w-full rounded-md border border-border bg-white/60 px-3 text-right text-sm tabular-nums shadow-sm transition focus:border-accent/60 focus:outline-none dark:bg-white/8" /><p className="text-right text-sm font-semibold tabular-nums">{idr(netAmount)}</p></div>; })}</div></div></div></section>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/80 bg-foreground/[0.025] px-5 py-4 sm:px-6"><div><p className="text-xs font-medium text-muted">Total kewajiban bersih</p><p className="mt-1 text-2xl font-semibold tabular-nums">{idr(total)}</p></div><button type="button" disabled={busy} onClick={() => void createRun()} className="inline-flex h-11 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 disabled:opacity-50"><CircleDollarSign className="h-4 w-4" />{busy ? "Menyimpan..." : "Simpan payroll draft"}</button></div>
        </GlassPanel> : null}
        {runs.length === 0 && !creatingRun ? (
          <GlassPanel className="grid min-h-64 place-items-center p-8 text-center">
            <div><WalletCards className="mx-auto h-7 w-7 text-accent" /><h2 className="mt-3 text-base font-semibold">Belum ada payroll</h2><p className="mt-1 max-w-sm text-sm text-muted">Buat payroll untuk memasukkan nominal bulan ini per Dokter, Perawat, dan Karyawan.</p></div>
          </GlassPanel>
        ) : runs.filter((run) => run.id === (selectedRunId ?? runs[0]?.id)).map((run) => {
          const totalPaid = run.items.reduce((sum, item) => sum + numberOf(item.paidAmount), 0n);
          const totalRemaining = numberOf(run.totalNetAmount) - totalPaid;
          return <GlassPanel key={run.id} className="grid gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2"><h2 className="text-base font-semibold">Payroll {new Date(run.period).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })}</h2><span className={`rounded-md px-2 py-1 text-xs font-semibold ${STATUS_TONE[run.status]}`}>{STATUS_LABEL[run.status]}</span></div>
                <p className="mt-1 text-xs text-muted">{run.items.length} karyawan · Beban bruto {idr(run.totalGrossAmount)}</p>
              </div>
              {run.status === "DRAFT" ? <div className="flex flex-wrap gap-2"><button type="button" title="Edit payroll draft" onClick={() => editRun(run)} className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted transition hover:bg-foreground/5 hover:text-foreground"><Pencil className="h-4 w-4" /></button><button type="button" title="Hapus payroll draft" onClick={() => setDeleteConfirm({ kind: "run", id: run.id, name: `Payroll ${new Date(run.period).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" })}` })} className="grid h-9 w-9 place-items-center rounded-md border border-danger/30 text-danger transition hover:bg-danger/8"><Trash2 className="h-4 w-4" /></button><button type="button" disabled={busy} onClick={() => void approveRun(run)} className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" />Setujui</button></div> : null}
            </div>

            <div className="grid grid-cols-2 gap-3 border-y border-border/70 py-3 sm:grid-cols-4">
              <div><p className="text-xs text-muted">Bruto</p><p className="mt-1 text-sm font-semibold tabular-nums">{idr(run.totalGrossAmount)}</p></div>
              <div><p className="text-xs text-muted">Utang gaji</p><p className="mt-1 text-sm font-semibold tabular-nums">{idr(run.totalNetAmount)}</p></div>
              <div><p className="text-xs text-muted">Sudah dibayar</p><p className="mt-1 text-sm font-semibold tabular-nums">{idr(totalPaid)}</p></div>
              <div><p className="text-xs text-muted">Sisa utang</p><p className="mt-1 text-sm font-semibold tabular-nums">{idr(totalRemaining)}</p></div>
            </div>

            {run.status !== "DRAFT" && totalRemaining > 0n ? <div className="rounded-md border border-accent/20 bg-accent/[0.035] p-3">
              <p className="text-sm font-semibold">Pembayaran per karyawan</p><p className="mt-1 text-xs text-muted">Setiap pembayaran dapat memakai akun kas atau bank yang berbeda.</p>
            </div> : null}

            <div className="overflow-hidden rounded-md border border-border">
              <div className="hidden grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(110px,1fr))] gap-4 bg-slate-950/[0.035] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted dark:bg-white/[0.045] sm:grid">
                <span>Karyawan</span><span className="text-right">Gaji bersih</span><span className="text-right">Terbayar</span><span className="text-right">Sisa utang</span>
              </div>
              <div className="divide-y divide-border/60">
                {run.items.map((item) => {
                  const key = `${run.id}:${item.employeeId}`;
                  const remaining = numberOf(item.netAmount) - numberOf(item.paidAmount);
                  const amount = paymentAmounts[key] ?? remaining.toString();
                  const paymentAccountId = paymentAccountIds[key] ?? "";
                  const paymentDate = paymentDates[key] ?? todayDate();
                  const canPay = run.status !== "DRAFT" && remaining > 0n;
                  return <div key={item.id ?? item.employeeId} className="px-4 py-4 text-sm transition hover:bg-foreground/[0.018]">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(110px,1fr))] sm:items-center sm:gap-4">
                      <div className="min-w-0"><p className="truncate font-semibold">{item.employeeName}</p><div className="mt-1 flex flex-wrap items-center gap-1.5"><span className="text-xs text-muted">{ROLE_LABEL[item.employeeRole]}</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PAYMENT_STATUS_TONE[item.paymentStatus]}`}>{PAYMENT_STATUS_LABEL[item.paymentStatus]}</span></div></div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><span className="text-xs text-muted sm:hidden">Gaji bersih</span><span className="tabular-nums">{idr(item.netAmount)}</span></div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><span className="text-xs text-muted sm:hidden">Terbayar</span><span className="tabular-nums text-muted">{idr(item.paidAmount)}</span></div>
                      <div className="flex items-center justify-between gap-3 sm:block sm:text-right"><span className="text-xs text-muted sm:hidden">Sisa utang</span><span className="font-semibold tabular-nums">{idr(remaining)}</span></div>
                    </div>
                    {canPay ? <div className="mt-4 grid gap-3 rounded-md border border-accent/15 bg-accent/[0.035] p-3 sm:grid-cols-[minmax(200px,1.25fr)_minmax(150px,.9fr)_minmax(140px,.8fr)_88px] sm:items-end">
                      <label className="grid gap-1.5 text-xs font-medium text-muted"><span>Sumber pembayaran</span><GlassDataSelect value={paymentAccountId} onChange={(value) => setPaymentAccountIds((current) => ({ ...current, [key]: value }))} options={accountOptions(cashAccounts)} placeholder="Pilih akun kas/bank" className="h-10 bg-white/70 dark:bg-white/8" /></label>
                      <label className="grid gap-1.5 text-xs font-medium text-muted"><span>Tanggal bayar</span><GlassDatePicker value={paymentDate} onChange={(value) => setPaymentDates((current) => ({ ...current, [key]: value }))} className="h-10 bg-white/70 dark:bg-white/8" /></label>
                      <label className="grid gap-1.5 text-xs font-medium text-muted"><span>Nominal bayar</span><MoneyField value={amount} onChange={(value) => setPaymentAmounts((current) => ({ ...current, [key]: value }))} placeholder="0" className="h-10 w-full rounded-md border border-border bg-white/70 px-3 text-right text-sm tabular-nums dark:bg-white/8" /></label>
                      <button type="button" disabled={busy || !paymentAccountId} onClick={() => void payItem(run, item)} className="h-10 rounded-md bg-success px-3 text-xs font-semibold text-white transition hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50">Bayar</button>
                    </div> : null}
                  </div>;
                })}
              </div>
            </div>
          </GlassPanel>;
        })}
      </main>
    </div>
    {deleteConfirm ? <div role="dialog" aria-modal="true" aria-label="Konfirmasi hapus" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm"><GlassPanel className="w-full max-w-md p-5 shadow-xl"><h2 className="text-base font-semibold">Hapus {deleteConfirm.kind === "employee" ? "karyawan" : "payroll draft"}?</h2><p className="mt-2 text-sm leading-6 text-muted">{deleteConfirm.name} akan dihapus. Tindakan ini tidak bisa dibatalkan.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteConfirm(null)} className="h-9 rounded-md border border-border px-3 text-sm font-medium">Batal</button><button type="button" disabled={busy} onClick={() => void deleteEntity()} className="h-9 rounded-md bg-danger px-3 text-sm font-semibold text-white disabled:opacity-50">Hapus</button></div></GlassPanel></div> : null}
  </div>;
}
