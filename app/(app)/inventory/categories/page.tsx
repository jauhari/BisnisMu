"use client";
import { z } from "zod";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { ManagedForm, RhfTextField } from "@/components/forms/rhf-form";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ name: z.string().min(2), description: z.string().optional() });
type CategoryForm = z.infer<typeof schema>;

export default function Page() {
  const mutation = usePostMutation("/api/inventory/categories");
  const { data, isLoading, error } = useListQuery<any[]>("/api/inventory/categories", ["list", "inventory-categories"]);
  if (isLoading) return <GlassSkeleton className="h-72" />;
  if (error || !data) return <GlassErrorState title="Kategori belum bisa dimuat" description="Coba muat ulang halaman." />;
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Persediaan" title="Kategori" description="Kelompokkan produk ke dalam kategori agar mudah dicari dan dianalisis." /><SplitWorkspace main={<GlassTable columns={[{ key: "name", header: "Nama" }, { key: "description", header: "Keterangan" }, { key: "status", header: "Status" }]} rows={data.data} empty="Belum ada kategori. Tambahkan lewat formulir di samping." />} side={<><GlassPanel><ManagedForm<CategoryForm> schema={schema} defaultValues={{ name: "", description: "" }} onSubmit={async (values) => { const payload: Record<string, unknown> = { name: values.name }; if (values.description) payload.description = values.description; await mutation.mutateAsync(payload); }}>{() => <div className="grid max-w-[560px] gap-4"><RhfTextField<CategoryForm> name="name" label="Nama kategori" placeholder="Minuman" /><RhfTextField<CategoryForm> name="description" label="Keterangan" placeholder="Opsional" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Simpan kategori</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Susunan kategori">Kategori bertingkat akan ditampilkan sebagai pohon.</DetailPanel></>} /></div>;
}
