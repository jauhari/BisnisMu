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
  if (error || !data) return <GlassErrorState title="Categories unavailable" description="Unable to load categories." />;
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Inventory" title="Categories" description="Product category hierarchy for inventory analytics and product organization." /><SplitWorkspace main={<GlassTable columns={[{ key: "name", header: "Name" }, { key: "description", header: "Description" }, { key: "status", header: "Status" }]} rows={data.data} empty="No categories loaded" />} side={<><GlassPanel><ManagedForm<CategoryForm> schema={schema} defaultValues={{ name: "", description: "" }} onSubmit={async (values) => { const payload: Record<string, unknown> = { name: values.name }; if (values.description) payload.description = values.description; await mutation.mutateAsync(payload); }}>{() => <div className="grid gap-4"><RhfTextField<CategoryForm> name="name" label="Category name" placeholder="Minuman" /><RhfTextField<CategoryForm> name="description" label="Description" placeholder="Opsional" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Save category</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Hierarchy">Nested categories are rendered as a tree table when data is connected.</DetailPanel></>} /></div>;
}
