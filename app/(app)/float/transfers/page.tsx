"use client";
import { z } from "zod";
import { ManagedForm, RhfTextField, RhfDataSelect, RhfDatePicker, RhfMoneyField, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { LOAD_ERROR_DESCRIPTION, TRANSACTION_COLUMNS, buildTransactionRows, floatAccountLabel } from "../float-labels";

const schema = z.object({
  floatAccountId: z.string().min(10, "Pilih akun rekanan asal."),
  destinationFloatAccountId: z.string().min(10, "Pilih akun rekanan tujuan."),
  transactionDate: z.string().min(1, "Pilih tanggal."),
  amount: z.string().min(1, "Isi nominal."),
  description: z.string().min(3, "Keterangan minimal 3 karakter."),
});
type TransferForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/float/transactions");
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  const workflows = useListQuery<any[]>("/api/float/workflows", ["list", "float-workflows"]);
  if (floats.isLoading) return <GlassSkeleton className="h-72" />;
  if (floats.error) return <GlassErrorState title="Saldo rekanan tidak bisa dimuat" description={LOAD_ERROR_DESCRIPTION} />;
  const floatList = floats.data?.data ?? [];
  const floatOptions: SelectOption[] = floatList.map((f: any) => ({ value: f.id, label: floatAccountLabel(f) }));
  const rows = buildTransactionRows(workflows.data?.data ?? [], floatList, "TRANSFER");
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Saldo Rekanan" title="Transfer Saldo Rekanan" description="Pindahkan saldo dari satu akun rekanan ke akun rekanan lain." /><SplitWorkspace main={<><GlassPanel><ManagedForm<TransferForm> schema={schema} defaultValues={{ floatAccountId: "", destinationFloatAccountId: "", transactionDate: new Date().toLocaleDateString("en-CA"), amount: "", description: "Transfer saldo rekanan" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "TRANSFER", floatAccountId: values.floatAccountId, destinationFloatAccountId: values.destinationFloatAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<TransferForm> name="floatAccountId" label="Dari akun rekanan" options={floatOptions} placeholder="Pilih akun asal" /><RhfDataSelect<TransferForm> name="destinationFloatAccountId" label="Ke akun rekanan" options={floatOptions} placeholder="Pilih akun tujuan" /><RhfDatePicker<TransferForm> name="transactionDate" label="Tanggal" /><RhfMoneyField<TransferForm> name="amount" label="Nominal" prefix placeholder="300.000" /><RhfTextField<TransferForm> name="description" label="Keterangan" placeholder="Contoh: Pindah saldo BukuWarung ke ShopeePay" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan transfer</button></div>}</ManagedForm></GlassPanel><GlassTable columns={TRANSACTION_COLUMNS} rows={rows} empty="Belum ada transfer saldo rekanan. Catat lewat form di atas." /></>} side={<DetailPanel title="Contoh jurnal">Saldo di akun rekanan tujuan bertambah (debit), saldo di akun rekanan asal berkurang (kredit). Total saldo rekanan tidak berubah.</DetailPanel>} /></div>;
}
