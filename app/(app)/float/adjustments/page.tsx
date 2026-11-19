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
  direction: z.enum(["INCREASE", "DECREASE"]),
  adjustmentAccountId: z.string().min(10, "Pilih akun lawan penyesuaian."),
  transactionDate: z.string().min(1, "Pilih tanggal."),
  amount: z.string().min(1, "Isi nominal."),
  description: z.string().min(3, "Keterangan minimal 3 karakter."),
});
type AdjustForm = z.infer<typeof schema>;

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
  const adjustmentOptions: SelectOption[] = flat.filter((a) => a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const rows = buildTransactionRows(workflows.data?.data ?? [], floatList, "ADJUSTMENT");
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Saldo Rekanan" title="Penyesuaian Saldo Rekanan" description="Koreksi saldo akun rekanan agar sama dengan saldo yang tercatat di aplikasi rekanan, misalnya karena ada bonus, cashback, atau selisih." /><SplitWorkspace main={<><GlassPanel><ManagedForm<AdjustForm> schema={schema} defaultValues={{ floatAccountId: "", direction: "INCREASE", adjustmentAccountId: "", transactionDate: new Date().toLocaleDateString("en-CA"), amount: "", description: "Penyesuaian saldo rekanan" }} onSubmit={async (values) => { await mutation.mutateAsync({ type: "ADJUSTMENT", floatAccountId: values.floatAccountId, direction: values.direction, adjustmentAccountId: values.adjustmentAccountId, transactionDate: values.transactionDate, amount: values.amount, description: values.description }); }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<AdjustForm> name="floatAccountId" label="Akun rekanan" options={floatOptions} placeholder="Pilih akun rekanan" /><RhfDataSelect<AdjustForm> name="direction" label="Jenis penyesuaian" options={[{ value: "INCREASE", label: "Tambah saldo" }, { value: "DECREASE", label: "Kurangi saldo" }]} placeholder="Pilih jenis" /><RhfDataSelect<AdjustForm> name="adjustmentAccountId" label="Akun lawan penyesuaian" options={adjustmentOptions} placeholder="Pilih akun" /><RhfDatePicker<AdjustForm> name="transactionDate" label="Tanggal" /><RhfMoneyField<AdjustForm> name="amount" label="Nominal" prefix placeholder="100.000" /><RhfTextField<AdjustForm> name="description" label="Keterangan" placeholder="Contoh: Cashback dari ShopeePay" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan penyesuaian</button></div>}</ManagedForm></GlassPanel><GlassTable columns={TRANSACTION_COLUMNS} rows={rows} empty="Belum ada penyesuaian saldo rekanan. Catat lewat form di atas." /></>} side={<DetailPanel title="Contoh jurnal">Tambah saldo: akun aset rekanan didebit (bertambah) dan akun lawan dikredit. Kurangi saldo: akun lawan didebit dan akun aset rekanan dikredit (berkurang).</DetailPanel>} /></div>;
}
