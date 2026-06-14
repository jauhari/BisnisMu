"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Edit3, FileText, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { WorkspaceHeader, DetailPanel, SplitWorkspace } from "@/components/layout/workspace";
import { apiRequest } from "@/presentation/api/client";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { filterTransactionHistoryRows, type TransactionHistoryRow, type TransactionHistoryTypeFilter } from "@/presentation/transactions/history";

type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "CASHIER" | "VIEWER";
type StatusFilter = "all" | "DRAFT" | "POSTED" | "CONFIRMED" | "PARTIALLY_PAID" | "PAID" | "VOID";

function canMutate(role?: Role) { return role === "OWNER" || role === "ADMIN" || role === "CASHIER"; }
function canDelete(role?: Role) { return role === "OWNER" || role === "ADMIN"; }
function canVoid(role?: Role) { return role === "OWNER" || role === "ADMIN"; }
function canHardMutate(role?: Role, hardMutation?: boolean) { return Boolean(hardMutation && (role === "OWNER" || role === "ADMIN" || role === "ACCOUNTANT")); }

export default function Page() {
  const history = useListQuery<{ role: Role; hardMutation?: boolean; rows: TransactionHistoryRow[] }>("/api/transactions/history", ["list", "transaction-history"]);

  const [type, setType] = useState<TransactionHistoryTypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const payload = history.data?.data;
  const role = payload?.role;
  const hardMutation = Boolean(payload?.hardMutation);
  const loading = history.isLoading;

  const rows = useMemo(() => {
    return payload?.rows ?? [];
  }, [payload]);

  const filtered = useMemo(() => filterTransactionHistoryRows(rows, { type, status, query, startDate, endDate }), [rows, type, status, query, startDate, endDate]);

  async function refresh() {
    await history.refetch?.();
  }

  async function action(row: TransactionHistoryRow, kind: "post" | "confirm" | "delete" | "void") {
    try {
      if (row.source === "CASH_TRANSACTION" && kind === "post") await apiRequest("/api/cash/transactions/post", { method: "POST", body: JSON.stringify({ transactionId: row.id }) });
      if (row.source === "CASH_TRANSACTION" && kind === "delete") await apiRequest(`/api/cash/transactions/${row.id}`, { method: "DELETE" });
      if (row.source === "CASH_TRANSACTION" && kind === "void") await apiRequest("/api/cash/transactions/void", { method: "POST", body: JSON.stringify({ transactionId: row.id, reason: `Void transaksi ${row.reference}` }) });
      if (row.source === "SALES_ORDER" && kind === "confirm") await apiRequest("/api/sales/orders/confirm", { method: "POST", body: JSON.stringify({ salesOrderId: row.id }) });
      if (row.source === "SALES_ORDER" && kind === "delete") await apiRequest(`/api/sales/orders/${row.id}`, { method: "DELETE" });
      if (row.source === "SALES_ORDER" && kind === "void") await apiRequest(`/api/sales/orders/${row.id}/void`, { method: "POST", body: JSON.stringify({ reason: `Void sales order ${row.reference}` }) });
      if (row.source === "DAILY_SALE" && kind === "delete") await apiRequest(`/api/sales/daily/${row.id}`, { method: "DELETE" });
      if (row.source === "DAILY_SALE" && kind === "void") await apiRequest(`/api/sales/daily/${row.id}`, { method: "DELETE", body: JSON.stringify({ reason: `Void penjualan harian ${row.id}` }) });
      toast.success("Aksi berhasil.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aksi gagal.");
    }
  }

  if (loading) return <GlassSkeleton className="h-72" />;

  return <div className="grid gap-6">
    <WorkspaceHeader eyebrow="Operasional" title="Riwayat Transaksi" description="Lihat penjualan, sales order, dan transaksi kas dalam satu tempat. Aksi edit mengikuti role dan status." />
    <SplitWorkspace main={<div className="grid gap-4">
      <div className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border border-border bg-white/45 p-3 sm:grid-cols-2 xl:grid-cols-[160px_180px_minmax(220px,1fr)_150px_150px] [&>*]:min-w-0 dark:bg-white/5">
        <GlassDataSelect value={type} onChange={(v) => setType(v as TransactionHistoryTypeFilter)} options={[{ value: "all", label: "Semua tipe" }, { value: "sales", label: "Penjualan" }, { value: "cash", label: "Kas" }]} />
        <GlassDataSelect value={status} onChange={(v) => setStatus(v as StatusFilter)} options={[{ value: "all", label: "Semua status" }, { value: "DRAFT", label: "Draft" }, { value: "POSTED", label: "Posted" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "PARTIALLY_PAID", label: "Partial" }, { value: "PAID", label: "Paid" }, { value: "VOID", label: "Void" }]} />
        <GlassInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor, keterangan, nominal..." />
        <GlassDatePicker value={startDate} onChange={setStartDate} placeholder="Dari tanggal" />
        <GlassDatePicker value={endDate} onChange={setEndDate} placeholder="Sampai tanggal" />
      </div>
      <GlassTable selectable={false} tableId="transaction-history" columns={[
        { key: "date", header: "Tanggal" },
        { key: "kind", header: "Jenis" },
        { key: "status", header: "Status" },
        { key: "description", header: "Keterangan" },
        { key: "amount", header: "Nominal", render: (row: any) => <span className={row.direction === "OUT" ? "font-medium text-danger" : row.direction === "IN" ? "font-medium text-success" : "font-medium"}>{row.direction === "OUT" ? "−" : row.direction === "IN" ? "+" : ""}{Number(row.amount).toLocaleString("id-ID")}</span> },
        { key: "actions", header: "Aksi", render: (row: TransactionHistoryRow) => <div className="flex flex-wrap gap-1.5"><Link href={row.href} className="rounded border border-border px-2 py-1 text-xs"><FileText className="inline h-3 w-3" /> Detail</Link>{((row.status === "DRAFT" && row.source !== "DAILY_SALE" && canMutate(role)) || (row.status !== "VOID" && canHardMutate(role, hardMutation))) ? <Link href={row.href} className="rounded border border-border px-2 py-1 text-xs"><Edit3 className="inline h-3 w-3" /> Edit</Link> : null}{row.status === "DRAFT" && row.source === "CASH_TRANSACTION" && canMutate(role) ? <button type="button" className="rounded bg-foreground px-2 py-1 text-xs text-background" onClick={() => void action(row, "post")}><Send className="inline h-3 w-3" /> Post</button> : null}{row.status === "DRAFT" && row.source === "SALES_ORDER" && canMutate(role) ? <button type="button" className="rounded bg-foreground px-2 py-1 text-xs text-background" onClick={() => void action(row, "confirm")}><Send className="inline h-3 w-3" /> Confirm</button> : null}{((row.status === "DRAFT" && row.source !== "DAILY_SALE" && canDelete(role)) || (row.status !== "VOID" && canHardMutate(role, hardMutation))) ? <button type="button" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger" onClick={() => void action(row, "delete")}><Trash2 className="inline h-3 w-3" /> Delete</button> : null}{row.status !== "DRAFT" && row.status !== "VOID" && canVoid(role) && !hardMutation ? <button type="button" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger" onClick={() => void action(row, "void")}><Undo2 className="inline h-3 w-3" /> Void</button> : null}</div> },
      ]} rows={filtered} empty="Belum ada transaksi yang cocok dengan filter." />
    </div>} side={<><DetailPanel title="Cara edit">Transaksi berstatus DRAFT bisa diedit dari tombol Edit. Untuk Bisnis Hanyukupi, role di atas Kasir dapat edit data yang sudah posted/confirmed.</DetailPanel><DetailPanel title="Kalau salah input">{hardMutation ? "Bisnis Hanyukupi memakai edit/delete langsung untuk role di atas Kasir; perubahan tetap dicatat di audit." : "Gunakan Void untuk membalik transaksi yang sudah masuk jurnal, lalu buat transaksi baru yang benar."}</DetailPanel><DetailPanel title="Akses role">Kasir bisa input dan posting draft. Void dan delete draft hanya OWNER atau ADMIN. Khusus Hanyukupi, OWNER, ADMIN, ACCOUNTANT mendapat edit/delete langsung.</DetailPanel></>} />
  </div>;
}
