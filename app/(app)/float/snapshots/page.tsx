"use client";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { LOAD_ERROR_DESCRIPTION, providerLabel } from "../float-labels";

export default function Page() {
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  if (floats.isLoading) return <GlassSkeleton className="h-72" />;
  if (floats.error) return <GlassErrorState title="Catatan saldo rekanan tidak bisa dimuat" description={LOAD_ERROR_DESCRIPTION} />;
  const list = floats.data?.data ?? [];
  const total = list.reduce((s: number, f: any) => s + Number(f.currentBalance ?? 0), 0);
  const rows = list.map((f: any) => ({ provider: providerLabel(f.provider), name: f.name, balance: formatRupiah(f.currentBalance ?? 0), status: f.isActive ? "Aktif" : "Nonaktif" }));
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Saldo Rekanan" title="Catatan Saldo Rekanan" description="Saldo terkini di setiap akun rekanan. Cocokkan angka ini dengan saldo yang tampil di aplikasi rekanan." /><section className="grid gap-4 md:grid-cols-2"><GlassStatsCard title="Total saldo rekanan" value={formatRupiah(total)} detail="Semua rekanan" /><GlassStatsCard title="Akun" value={String(rows.length)} detail="Akun rekanan terdaftar" /></section><SplitWorkspace main={<GlassTable columns={[{ key: "provider", header: "Rekanan" }, { key: "name", header: "Nama" }, { key: "balance", header: "Saldo" }, { key: "status", header: "Status" }]} rows={rows} empty="Belum ada akun rekanan. Tambahkan dulu di menu Akun Rekanan." />} side={<DetailPanel title="Tentang saldo">Saldo diperbarui otomatis setiap kali ada isi saldo, pemakaian, transfer, atau penyesuaian. Jika berbeda dengan aplikasi rekanan, catat selisihnya di menu Penyesuaian.</DetailPanel>} /></div>;
}
