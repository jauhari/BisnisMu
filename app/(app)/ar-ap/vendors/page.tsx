"use client";
import { z } from "zod";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { ManagedForm, RhfTextField } from "@/components/forms/rhf-form";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ name: z.string().min(2), email: z.string().email().or(z.literal("")).optional(), phone: z.string().optional(), address: z.string().optional() });
type VendorForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/ar-ap/vendors");
  const { data, isLoading, error } = useListQuery<any[]>("/api/ar-ap/vendors", ["list", "ar-ap-vendors"]);
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Daftar pemasok belum bisa dimuat" description="Coba muat ulang halaman." />;
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Piutang & Utang" title="Pemasok" description="Simpan data pemasok supaya bisa dipilih saat membuat tagihan dan pembayaran." /><SplitWorkspace main={<GlassTable columns={[{ key: "name", header: "Nama" }, { key: "email", header: "Email" }, { key: "phone", header: "Telepon" }, { key: "address", header: "Alamat" }, { key: "status", header: "Status" }]} rows={data.data} empty="Belum ada pemasok. Tambahkan lewat formulir di samping." />} side={<><GlassPanel><ManagedForm<VendorForm> schema={schema} defaultValues={{ name: "", email: "", phone: "", address: "" }} onSubmit={async (values) => { const payload: Record<string, unknown> = { name: values.name }; if (values.email) payload.email = values.email; if (values.phone) payload.phone = values.phone; if (values.address) payload.address = values.address; await mutation.mutateAsync(payload); }}>{() => <div className="grid max-w-[560px] gap-4"><RhfTextField<VendorForm> name="name" label="Nama pemasok" placeholder="PT Pemasok" /><RhfTextField<VendorForm> name="email" label="Email" placeholder="email@contoh.id" /><RhfTextField<VendorForm> name="phone" label="Telepon" placeholder="0812..." /><RhfTextField<VendorForm> name="address" label="Alamat" placeholder="Alamat" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan pemasok</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Profil pemasok">Detail kontak dan riwayat transaksi pemasok bisa dilihat dari daftar.</DetailPanel></>} /></div>;
}
