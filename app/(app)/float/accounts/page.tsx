"use client";
import { z } from "zod";
import { useMemo } from "react";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassStatsCard, GlassPanel } from "@/components/glass/glass-primitives";
import { GlassTable } from "@/components/tables/glass-table";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { formatRupiah } from "@/presentation/format/number";
import { LOAD_ERROR_DESCRIPTION, PROVIDER_OPTIONS, flattenAccounts, providerLabel } from "../float-labels";

const schema = z.object({
  provider: z.enum(["BUKUWARUNG", "FASTPAY", "PAYFAZZ", "SHOPEEPAY", "LINKAJA", "CUSTOM"]),
  name: z.string().min(2, "Nama akun minimal 2 karakter."),
  floatAssetAccountId: z.string().min(10, { message: "Pilih akun aset untuk saldo rekanan." }),
  offsetAccountId: z.string().min(10, { message: "Pilih akun lawan bawaan." }),
});
type FloatForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/float/accounts");
  const { data, isLoading, error } = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  if (isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data || accounts.error) return <GlassErrorState title="Akun rekanan tidak bisa dimuat" description={LOAD_ERROR_DESCRIPTION} />;
  const accountById = new Map(flat.map((a) => [a.id, a]));
  const assetOptions: SelectOption[] = flat.filter((a) => a.groupCode === 1 && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const offsetOptions: SelectOption[] = flat.filter((a) => a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const list = data.data;
  const totalBalance = list.reduce((sum: number, row: any) => sum + Number(row.currentBalance ?? row.balance ?? 0), 0);
  const providers = new Set(list.map((row: any) => row.provider)).size;
  const rows = list.map((row: any) => {
    const asset = accountById.get(row.floatAssetAccountId);
    return { provider: providerLabel(row.provider), name: row.name, currentBalance: formatRupiah(row.currentBalance ?? row.balance ?? 0), assetAccount: asset ? `${asset.code} ${asset.name}` : "-", status: row.isActive === false ? "Nonaktif" : "Aktif" };
  });
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Saldo Rekanan" title="Akun Rekanan" description="Daftar akun saldo di rekanan (mis. BukuWarung, ShopeePay, LinkAja) yang dipakai untuk jualan pulsa, token, atau pembayaran." /><section className="grid gap-4 md:grid-cols-3"><GlassStatsCard title="Total saldo" value={formatRupiah(totalBalance)} detail="Semua rekanan" /><GlassStatsCard title="Rekanan" value={String(providers)} detail="Jumlah rekanan berbeda" /><GlassStatsCard title="Akun" value={String(list.length)} detail="Akun rekanan terdaftar" /></section><SplitWorkspace main={<GlassTable columns={[{ key: "provider", header: "Rekanan" }, { key: "name", header: "Nama" }, { key: "currentBalance", header: "Saldo" }, { key: "assetAccount", header: "Akun aset" }, { key: "status", header: "Status" }]} rows={rows} empty="Belum ada akun rekanan. Tambahkan lewat form di samping." />} side={<><GlassPanel><ManagedForm<FloatForm> schema={schema} defaultValues={{ provider: "CUSTOM", name: "", floatAssetAccountId: "", offsetAccountId: "" }} onSubmit={async (values) => { await mutation.mutateAsync(values); }}>{() => <div className="grid gap-4"><RhfDataSelect<FloatForm> name="provider" label="Rekanan" options={PROVIDER_OPTIONS} placeholder="Pilih rekanan" /><RhfTextField<FloatForm> name="name" label="Nama akun" placeholder="Contoh: Saldo BukuWarung Toko" /><RhfDataSelect<FloatForm> name="floatAssetAccountId" label="Akun aset saldo rekanan" options={assetOptions} placeholder="Pilih akun aset" /><RhfDataSelect<FloatForm> name="offsetAccountId" label="Akun lawan bawaan" options={offsetOptions} placeholder="Pilih akun lawan" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan akun rekanan</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Cara mengisi">Akun aset adalah tempat saldo rekanan dicatat di Bagan Akun (biasanya kelompok Aset). Akun lawan bawaan dipakai otomatis bila saat transaksi Anda tidak memilih akun kas/bank atau akun beban.</DetailPanel></>} /></div>;
}
