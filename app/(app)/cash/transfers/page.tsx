"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, FileText, Landmark, Plus, Save, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { ManagedForm, RhfDataSelect, RhfDatePicker, RhfMoneyField, RhfTextField, type SelectOption } from "@/components/forms/rhf-form";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { FormDrawer } from "@/components/layout/form-drawer";
import { DetailPanel, SplitWorkspace, WorkspaceHeader } from "@/components/layout/workspace";
import { useSessionContext } from "@/components/layout/session-context";
import { GlassTable } from "@/components/tables/glass-table";
import { apiRequest } from "@/presentation/api/client";
import { formatRupiah } from "@/presentation/format/number";
import { ConfirmActionDialog, type ConfirmActionState } from "../_components/confirm-action-dialog";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

const schema = z.object({
  transactionDate: z.string().min(1),
  cashAccountId: z.string().min(1, "Pilih kas atau bank sumber."),
  destinationAccountId: z.string().min(1, "Pilih kas atau bank tujuan."),
  amount: z.string().min(1, "Isi nominal transfer."),
  description: z.string().min(3, "Keterangan minimal 3 karakter."),
});

type TransferForm = z.infer<typeof schema>;
type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "CASHIER" | "VIEWER";

const emptyForm = (): TransferForm => ({
  transactionDate: new Date().toISOString().slice(0, 10),
  cashAccountId: "",
  destinationAccountId: "",
  amount: "",
  description: "",
});

function flattenAccounts(nodes: any[]): any[] {
  return nodes.flatMap((node) => [node, ...flattenAccounts(node.children ?? [])]);
}

function moneyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isCashOrBank(account: any): boolean {
  const subtype = String(account.subtype ?? "").toLowerCase();
  return account.isPostingAllowed && (subtype === "cash" || subtype === "bank" || (account.groupCode === 1 && String(account.code).startsWith("11")));
}

function canCreate(role?: Role): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "CASHIER";
}

function canApprove(role?: Role): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "CASHIER";
}

function canReverse(role?: Role): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export default function Page() {
  const queryClient = useQueryClient();
  const transfers = useListQuery<any[]>("/api/cash/transfers", ["list", "cash-transfers"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  // Role sudah dari SessionProvider — tidak ada request tambahan per halaman.
  const { activeBusiness: sessionBusiness } = useSessionContext();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmActionState>(null);

  const role = sessionBusiness?.role as Role | undefined;
  const flatAccounts = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const accountById = useMemo(() => new Map(flatAccounts.map((account) => [account.id, account])), [flatAccounts]);
  const cashBankOptions = useMemo<SelectOption[]>(() => flatAccounts
    .filter(isCashOrBank)
    .map((account) => ({ value: account.id, label: account.name, code: account.code, name: account.name, groupLabel: "Kas & Bank" })), [flatAccounts]);

  const rows = useMemo(() => ((transfers.data as any)?.data ?? []).map((transfer: any) => {
    const source = accountById.get(transfer.cashAccountId);
    const destination = accountById.get(transfer.destinationAccountId);
    return {
      ...transfer,
      number: transfer.transactionNumber,
      transactionDate: transfer.transactionDate,
      fromAccount: source ? `${source.code} | ${source.name}` : "Akun tidak tersedia",
      toAccount: destination ? `${destination.code} | ${destination.name}` : "Akun tidak tersedia",
      nominal: formatRupiah(transfer.amount),
      note: transfer.description,
    };
  }), [accountById, transfers.data]);

  async function createTransfer(values: TransferForm): Promise<void> {
    if (values.cashAccountId === values.destinationAccountId) {
      throw new Error("Akun sumber dan tujuan harus berbeda.");
    }

    await apiRequest("/api/cash/transfers", {
      method: "POST",
      body: JSON.stringify({
        movementDate: values.transactionDate,
        sourceCashAccountId: values.cashAccountId,
        destinationCashAccountId: values.destinationAccountId,
        amount: moneyDigits(values.amount),
        description: values.description.trim(),
      }),
    });
    await queryClient.invalidateQueries({ queryKey: ["list", "cash-transfers"] });
    await queryClient.invalidateQueries({ queryKey: ["list", "cash-transactions"] });
    setDrawerOpen(false);
  }

  async function runAction(transfer: any, action: "post" | "delete" | "void"): Promise<void> {
    setBusyId(transfer.id);
    try {
      if (action === "post") await apiRequest("/api/cash/transactions/post", { method: "POST", body: JSON.stringify({ transactionId: transfer.id }) });
      if (action === "delete") await apiRequest(`/api/cash/transactions/${transfer.id}`, { method: "DELETE" });
      if (action === "void") await apiRequest("/api/cash/transactions/void", { method: "POST", body: JSON.stringify({ transactionId: transfer.id, reason: `Void transfer ${transfer.transactionNumber}` }) });
      toast.success(action === "post" ? "Transfer diposting ke jurnal." : action === "void" ? "Transfer dibatalkan dengan jurnal pembalik." : "Draft transfer dihapus.");
      await queryClient.invalidateQueries({ queryKey: ["list", "cash-transfers"] });
      await queryClient.invalidateQueries({ queryKey: ["list", "cash-transactions"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aksi transfer gagal.");
    } finally {
      setBusyId(null);
    }
  }

  const actionClass = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white/60 text-muted transition hover:border-accent/50 hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-white/5";
  const actionPostClass = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-accent/40 bg-accent/15 text-accent transition hover:border-accent/60 hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-45";
  const actionDangerClass = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-danger/35 bg-danger/10 text-danger transition hover:border-danger/55 hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-45";
  const columns = [
    { key: "number", header: "Nomor" },
    { key: "transactionDate", header: "Tanggal" },
    { key: "fromAccount", header: "Dari" },
    { key: "toAccount", header: "Ke" },
    { key: "nominal", header: "Nominal" },
    { key: "status", header: "Status", render: (row: any) => <span className={row.status === "POSTED" ? "font-medium text-success" : row.status === "VOID" ? "font-medium text-danger" : "font-medium text-amber-700 dark:text-amber-300"}>{row.status === "POSTED" ? "Diposting" : row.status === "VOID" ? "Dibatalkan" : "Draf"}</span> },
    { key: "actions", header: "Aksi", render: (row: any) => <div className="flex flex-wrap gap-1.5" aria-label={`Aksi ${row.number}`}>
      <button type="button" title="Lihat keterangan" aria-label="Lihat keterangan" className={actionClass} onClick={() => toast.info(row.note)}><FileText className="h-4 w-4" /></button>
      {row.status === "DRAFT" && canApprove(role) ? <button type="button" title="Posting transfer" aria-label="Posting transfer" disabled={busyId === row.id} className={actionPostClass} onClick={() => void runAction(row, "post")}><Send className="h-4 w-4" /></button> : null}
      {row.status === "DRAFT" && canReverse(role) ? <button type="button" title="Hapus draft" aria-label="Hapus draft" disabled={busyId === row.id} className={actionDangerClass} onClick={() => setConfirmState({ title: "Hapus transfer", message: "Hapus draf transfer ini? Tindakan ini tidak bisa dibatalkan.", confirmLabel: "Ya, hapus", onConfirm: () => void runAction(row, "delete") })}><Trash2 className="h-4 w-4" /></button> : null}
      {row.status === "POSTED" && canReverse(role) ? <button type="button" title="Batalkan transfer" aria-label="Batalkan transfer" disabled={busyId === row.id} className={actionDangerClass} onClick={() => setConfirmState({ title: "Batalkan transfer", message: "Batalkan transfer ini? Jurnal pembalik akan dibuat dan status berubah menjadi Dibatalkan.", confirmLabel: "Ya, batalkan", onConfirm: () => void runAction(row, "void") })}><Undo2 className="h-4 w-4" /></button> : null}
    </div> },
  ];

  if (transfers.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (transfers.error) return <GlassErrorState title="Transfer dana tidak tersedia" description="Riwayat transfer tidak dapat dimuat saat ini." />;

  return <div className="grid gap-5 sm:gap-6">
    <WorkspaceHeader eyebrow="Kas & Bank" title="Transfer Dana Kas & Bank" description="Pindahkan dana antar akun kas atau bank tanpa mencatat pendapatan maupun beban baru." action={canCreate(role) ? <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 sm:w-auto"><Plus className="h-4 w-4" />Buat transfer</button> : null} />
    <SplitWorkspace main={<><GlassTable selectable={false} tableId="cash-transfers" columns={columns} rows={rows} empty="Belum ada transfer dana." /><div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-white/45 px-3 py-2.5 text-xs text-muted dark:bg-white/5"><span className="font-medium text-foreground">Aksi:</span><span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Detail</span><span className="inline-flex items-center gap-1.5"><Send className="h-3.5 w-3.5" />Posting</span><span className="inline-flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5 text-danger" />Hapus draft</span><span className="inline-flex items-center gap-1.5"><Undo2 className="h-3.5 w-3.5 text-danger" />Batalkan</span></div></>} side={<><DetailPanel title="Alur transfer dana"><div className="grid gap-2"><p>1. Penerimaan dicatat lebih dulu sebagai kas masuk ke akun kas.</p><p>2. Saat dana disetor, buat transfer dari akun kas ke rekening bank.</p><p>3. Setelah diposting, jurnalnya Debit rekening bank dan Kredit akun kas.</p></div></DetailPanel><DetailPanel title="Aturan penting">Transfer tidak menambah pendapatan. Pendapatan hanya dicatat saat penerimaan pertama kali, bukan saat uang dipindahkan ke rekening bank.</DetailPanel></>} />
    <FormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Buat transfer dana" subtitle="Simpan sebagai draft terlebih dahulu. Saldo dan jurnal berubah setelah transfer diposting.">
      <ManagedForm<TransferForm> schema={schema} defaultValues={emptyForm()} onSubmit={createTransfer}>{({ form, submitting }) => {
        const sourceId = form.watch("cashAccountId");
        const destinationId = form.watch("destinationAccountId");
        const source = accountById.get(sourceId);
        const destination = accountById.get(destinationId);
        const journalReady = source && destination && sourceId !== destinationId;
        return <div className="grid gap-6 pb-1">
          <section className="grid gap-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ArrowRightLeft className="h-4 w-4 text-accent" />Arah perpindahan dana</div><div className="grid gap-4 sm:grid-cols-2"><RhfDataSelect<TransferForm> name="cashAccountId" label="Dari kas/bank" options={cashBankOptions} placeholder="Pilih sumber dana" /><RhfDataSelect<TransferForm> name="destinationAccountId" label="Ke kas/bank" options={cashBankOptions} placeholder="Pilih tujuan dana" /></div></section>
          <section className="grid gap-4 border-t border-border/70 pt-5"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Landmark className="h-4 w-4 text-accent" />Rincian transfer</div><div className="grid gap-4 sm:grid-cols-2"><RhfDatePicker<TransferForm> name="transactionDate" label="Tanggal transfer" /><RhfMoneyField<TransferForm> name="amount" label="Nominal" prefix placeholder="100.000" className="h-12 bg-accent/5 text-base font-semibold" /></div><RhfTextField<TransferForm> name="description" label="Keterangan" placeholder="Contoh: Setoran infaq Jamaah ke BRImo" /></section>
          <section className="rounded-lg border border-accent/20 bg-accent/[0.06] p-4"><p className="text-sm font-semibold text-foreground">Pratinjau jurnal saat diposting</p>{journalReady ? <div className="mt-3 grid gap-2 text-sm"><div className="flex justify-between gap-4"><span className="text-muted">Debit</span><span className="text-right font-medium">{destination.code} | {destination.name}</span></div><div className="flex justify-between gap-4"><span className="text-muted">Kredit</span><span className="text-right font-medium">{source.code} | {source.name}</span></div></div> : <p className="mt-2 text-sm leading-6 text-muted">Pilih akun sumber dan tujuan yang berbeda untuk melihat jurnal transfer.</p>}</section>
          <div className="flex justify-end border-t border-border/70 pt-5"><button type="submit" disabled={submitting || !cashBankOptions.length} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"><Save className="h-4 w-4" />Simpan draft</button></div>
        </div>;
      }}</ManagedForm>
    </FormDrawer>
    <ConfirmActionDialog state={confirmState} onClose={() => setConfirmState(null)} />
  </div>;
}
