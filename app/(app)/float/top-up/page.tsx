"use client";
import { z } from "zod";
import { useMemo } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, RhfDatePicker, RhfMoneyField, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { LOAD_ERROR_DESCRIPTION, TRANSACTION_COLUMNS, buildTransactionRows, flattenAccounts, floatAccountLabel } from "../float-labels";

const schema = z.object({
  floatAccountId: z.string().min(10, "Pilih akun rekanan."),
  cashAccountId: z.string().min(10, "Pilih akun kas atau bank."),
  transactionDate: z.string().min(1, "Pilih tanggal."),
  amount: z.string().min(1, "Isi nominal."),
  description: z.string().min(3, "Keterangan minimal 3 karakter."),
});
type TopupForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/float/transactions");
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const workflows = useListQuery<any[]>("/api/float/workflows", ["list", "float-workflows"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  if (floats.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (floats.error || accounts.error) return <GlassErrorState title="Saldo rekanan tidak bisa dimuat" description={LOAD_ERROR_DESCRIPTION} />;
  const floatList = floats.data?.data ?? [];
  const floatOptions: SelectOption[] = floatList.map((f: any) => ({ value: f.id, label: floatAccountLabel(f) }));
  const cashOptions: SelectOption[] = flat.filter((a) => (a.subtype === "cash" || a.subtype === "bank") && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const rows = buildTransactionRows(workflows.data?.data ?? [], floatList, "TOPUP");
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Saldo Rekanan" title="Isi Saldo Rekanan" description="Catat pengisian saldo ke akun rekanan (mis. BukuWarung, ShopeePay) yang dibayar dari kas atau rekening bank." /><SplitWorkspace main={<><GlassPanel><ManagedForm<TopupForm> schema={schema} defaultValues={{ floatAccountId: "", cashAccountId: "", transactionDate: new Date().toLocaleDateString("en-CA"), amount: "", description: "Isi saldo rekanan" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "TOPUP", floatAccountId: values.floatAccountId, cashAccountId: values.cashAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<TopupForm> name="floatAccountId" label="Akun rekanan" options={floatOptions} placeholder="Pilih akun rekanan" /><RhfDataSelect<TopupForm> name="cashAccountId" label="Dibayar dari (kas/bank)" options={cashOptions} placeholder="Pilih akun kas/bank" /><RhfDatePicker<TopupForm> name="transactionDate" label="Tanggal" /><RhfMoneyField<TopupForm> name="amount" label="Nominal" prefix placeholder="800.000" /><RhfTextField<TopupForm> name="description" label="Keterangan" placeholder="Contoh: Isi saldo ShopeePay untuk jualan pulsa" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan isi saldo</button></div>}</ManagedForm></GlassPanel><GlassTable columns={TRANSACTION_COLUMNS} rows={rows} empty="Belum ada transaksi isi saldo. Catat lewat form di atas." /></>} side={<DetailPanel title="Contoh jurnal">Saldo di akun rekanan bertambah (debit akun aset rekanan), sedangkan uang di kas/bank berkurang (kredit kas/bank) sebesar nominal yang diisi.</DetailPanel>} /></div>;
}
