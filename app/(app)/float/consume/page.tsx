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
  expenseAccountId: z.string().min(10, "Pilih akun beban."),
  transactionDate: z.string().min(1, "Pilih tanggal."),
  amount: z.string().min(1, "Isi nominal."),
  description: z.string().min(3, "Keterangan minimal 3 karakter."),
});
type ConsumeForm = z.infer<typeof schema>;

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
  const expenseOptions: SelectOption[] = flat.filter((a) => (a.groupCode === 5 || a.groupCode === 6) && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const rows = buildTransactionRows(workflows.data?.data ?? [], floatList, "CONSUME");
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Saldo Rekanan" title="Pemakaian Saldo Rekanan" description="Catat saldo rekanan yang terpakai, misalnya untuk membeli stok pulsa atau membayar biaya, beserta akun bebannya." /><SplitWorkspace main={<><GlassPanel><ManagedForm<ConsumeForm> schema={schema} defaultValues={{ floatAccountId: "", expenseAccountId: "", transactionDate: new Date().toLocaleDateString("en-CA"), amount: "", description: "Pemakaian saldo rekanan" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "CONSUME", floatAccountId: values.floatAccountId, expenseAccountId: values.expenseAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<ConsumeForm> name="floatAccountId" label="Akun rekanan" options={floatOptions} placeholder="Pilih akun rekanan" /><RhfDataSelect<ConsumeForm> name="expenseAccountId" label="Dipakai untuk (akun beban/HPP)" options={expenseOptions} placeholder="Pilih akun beban" /><RhfDatePicker<ConsumeForm> name="transactionDate" label="Tanggal" /><RhfMoneyField<ConsumeForm> name="amount" label="Nominal" prefix placeholder="500.000" /><RhfTextField<ConsumeForm> name="description" label="Keterangan" placeholder="Contoh: Beli stok pulsa dari saldo BukuWarung" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan pemakaian</button></div>}</ManagedForm></GlassPanel><GlassTable columns={TRANSACTION_COLUMNS} rows={rows} empty="Belum ada transaksi pemakaian saldo. Catat lewat form di atas." /></>} side={<DetailPanel title="Contoh jurnal">Biaya atau HPP bertambah (debit akun beban yang dipilih), sedangkan saldo di akun rekanan berkurang (kredit akun aset rekanan).</DetailPanel>} /></div>;
}
