"use client";

import { useMemo, useState } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";
import { formatRupiah } from "@/presentation/format/number";

const todayIso = () => new Date().toISOString().slice(0, 10);
function addDays(iso: string, days: number) { const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

export default function Page() {
  const mutation = usePostMutation("/api/purchase/vendor-bills");
  const list = useListQuery<any[]>("/api/purchase/vendor-bills", ["list", "purchase-vendor-bills"]);
  const orders = useListQuery<any[]>("/api/purchase/orders/list", ["list", "purchase-orders"]);
  const vendors = useListQuery<any[]>("/api/ar-ap/vendors", ["list", "ar-ap-vendors"]);

  const [orderId, setOrderId] = useState("");
  const [billDate, setBillDate] = useState(() => todayIso());
  const [dueDate, setDueDate] = useState(() => addDays(todayIso(), 30));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const orderList = (orders.data as any)?.data ?? [];
  const vendorList = (vendors.data as any)?.data ?? [];
  const vendorName = (id: string) => vendorList.find((v: any) => v.id === id)?.name ?? id;
  const billable = useMemo(() => orderList.filter((o: any) => o.status === "RECEIVED"), [orderList]);

  if (list.isLoading || orders.isLoading || vendors.isLoading) return <GlassSkeleton className="h-72" />;
  if (list.error) return <GlassErrorState title="Tagihan pemasok belum bisa dimuat" description="Coba muat ulang halaman." />;

  async function submit() {
    setError(null); setOkMsg(null);
    if (!orderId) { setError("Pilih pesanan pembelian yang barangnya sudah diterima."); return; }
    if (description.trim().length < 2) { setError("Isi deskripsi tagihan."); return; }
    try {
      await mutation.mutateAsync({ purchaseOrderId: orderId, billDate, dueDate, description: description.trim() });
      setOkMsg("Tagihan pemasok dibuat dari pesanan pembelian."); setOrderId(""); setDescription("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat tagihan pemasok."); }
  }

  const rows = ((list.data as any)?.data ?? []).map((o: any) => ({ bill: o.orderNumber ?? o.id, vendor: vendorName(o.supplierId), po: o.orderNumber ?? o.id, due: "-", amount: formatRupiah(o.totalAmount) }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Pembelian" title="Tagihan Pemasok" description="Buat tagihan pemasok dari pesanan pembelian yang barangnya sudah diterima." /><SplitWorkspace main={<GlassTable columns={[{ key: "bill", header: "Tagihan" }, { key: "vendor", header: "Pemasok" }, { key: "po", header: "No. pesanan" }, { key: "due", header: "Jatuh tempo" }, { key: "amount", header: "Nilai" }]} rows={rows} empty="Belum ada tagihan. Pilih pesanan yang sudah diterima di panel samping untuk membuatnya." />} side={<><GlassPanel><div className="grid gap-4"><label className="grid gap-1"><span className="text-xs text-muted">Pesanan pembelian (sudah diterima)</span><GlassDataSelect value={orderId} onChange={setOrderId} placeholder={billable.length ? "Pilih pesanan" : "Belum ada pesanan yang barangnya sudah diterima"} options={billable.map((o: any) => ({ value: o.id, label: `${o.orderNumber ?? o.id} · ${vendorName(o.supplierId)}` }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Tanggal tagihan</span><GlassDatePicker value={billDate} onChange={setBillDate} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Jatuh tempo</span><GlassDatePicker value={dueDate} onChange={setDueDate} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Keterangan</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} className="h-10" placeholder="Tagihan pembelian" /></label><button type="button" onClick={() => void submit()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Buat tagihan</button>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}</div></GlassPanel><DetailPanel title="Yang terjadi">Membuat tagihan akan mencatat utang ke pemasok dan menandai pesanan sebagai selesai.</DetailPanel></>} /></div>;
}
