"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ManagedForm, RhfTextField, RhfDataSelect, RhfMoneyField, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { FormDrawer } from "@/components/layout/form-drawer";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ transactionDate: z.string().min(1), cashAccountId: z.string().min(10), categoryAccountId: z.string().min(10), amount: z.string().min(1), description: z.string().min(3) });
type ExpenseForm = z.infer<typeof schema>;

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }
async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? json?.error?.message ?? "Gagal menyimpan transaksi.");
  return json;
}

export default function Page() {
  const list = useListQuery<any[]>("/api/cash/transactions", ["list", "cash-transactions"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashOptions: SelectOption[] = flat.filter((a) => (a.subtype === "cash" || a.subtype === "bank" || String(a.code).startsWith("11")) && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.name}`, code: a.code, name: a.name, groupLabel: "Kas/Bank" }));
  const expenseOptions: SelectOption[] = flat.filter((a) => (a.groupCode === 6 || a.groupCode === 7 || a.groupCode === 5) && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.name}`, code: a.code, name: a.name, groupLabel: a.groupCode === 5 ? "HPP" : "Beban", normalBalance: a.normalBalance }));

  const [drawerOpen, setDrawerOpen] = useState(false);

  if (accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const rows = ((list.data as any)?.data ?? []).map((tx: any) => ({ number: tx.transactionNumber, type: tx.type === "CASH_OUT" ? "Pengeluaran" : tx.type === "CASH_IN" ? "Pemasukan" : "Transfer", date: tx.transactionDate?.slice?.(0, 10) ?? tx.transactionDate, status: tx.status, amount: String(tx.amount), memo: tx.description }));
  const addButton = <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background"><Plus className="h-4 w-4" />Tambah pengeluaran</button>;

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Kas & Bank" title="Pengeluaran Kas" description="Catat biaya operasional seperti listrik, sampah, obat, perlengkapan, dan perawatan. Sistem otomatis membuat jurnal." action={addButton} /><SplitWorkspace main={<GlassTable selectable={false} columns={[{ key: "number", header: "Nomor" }, { key: "type", header: "Tipe" }, { key: "date", header: "Tanggal" }, { key: "status", header: "Status" }, { key: "amount", header: "Nominal", render: (row: any) => <span className="font-medium text-danger">{Number(row.amount).toLocaleString("id-ID")}</span> }, { key: "memo", header: "Keterangan" }]} rows={rows} empty="Belum ada transaksi kas. Klik Tambah pengeluaran." />} side={<><DetailPanel title="Jurnal otomatis">Pengeluaran akan memposting Debit akun beban dan Credit kas/bank yang dipilih.</DetailPanel><DetailPanel title="Kapan pakai jurnal manual?">Gunakan jurnal manual untuk koreksi, penyesuaian akhir periode, reversal, atau transaksi khusus yang tidak punya modul.</DetailPanel></>} />
    <FormDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Tambah pengeluaran" subtitle="Untuk biaya operasional harian WaterByur dan unit lain.">
      <ManagedForm<ExpenseForm> schema={schema} defaultValues={{ transactionDate: new Date().toISOString().slice(0, 10), cashAccountId: "", categoryAccountId: "", amount: "", description: "" }} onSubmit={async (values) => { const created = await postJson("/api/cash/transactions", { type: "CASH_OUT", ...values }); const id = created?.data?.id; if (id) await postJson("/api/cash/transactions/post", { transactionId: id }); await list.refetch?.(); setDrawerOpen(false); }}>{() => <div className="grid gap-4"><RhfTextField<ExpenseForm> name="transactionDate" label="Tanggal" placeholder="2026-06-09" /><RhfDataSelect<ExpenseForm> name="cashAccountId" label="Dibayar dari" options={cashOptions} placeholder="Pilih kas/bank" /><RhfDataSelect<ExpenseForm> name="categoryAccountId" label="Kategori beban" options={expenseOptions} placeholder="Pilih beban" /><RhfMoneyField<ExpenseForm> name="amount" label="Nominal" placeholder="100.000" /><RhfTextField<ExpenseForm> name="description" label="Keterangan" placeholder="Token listrik / bayar sampah / beli obat" /><button type="submit" className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Simpan & posting pengeluaran</button></div>}</ManagedForm>
    </FormDrawer>
  </div>;
}