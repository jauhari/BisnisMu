"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { useListQuery, usePostMutation, usePatchMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ type: z.enum(["PHYSICAL", "DIGITAL", "SERVICE"]), sku: z.string().min(1), name: z.string().min(2), revenueAccountId: z.string().min(10), categoryId: z.string().optional(), inventoryAccountId: z.string().optional(), cogsAccountId: z.string().optional() }).superRefine((val, ctx) => {
  if (val.type === "PHYSICAL") {
    if (!val.inventoryAccountId || val.inventoryAccountId.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inventoryAccountId"], message: "Wajib untuk produk fisik" });
    if (!val.cogsAccountId || val.cogsAccountId.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cogsAccountId"], message: "Wajib untuk produk fisik" });
  }
});
type ProductForm = z.infer<typeof schema>;
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

export default function Page() {
  const createMutation = usePostMutation("/api/inventory/products");
  const updateMutation = usePatchMutation<ProductForm & { productId: string }>((payload) => `/api/inventory/products/${payload.productId}`);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const categories = useListQuery<any[]>("/api/inventory/categories", ["list", "inventory-categories"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const [editing, setEditing] = useState<any | null>(null);

  if (products.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (products.error || !products.data) return <GlassErrorState title="Products unavailable" description="Unable to load products." />;

  const postable = flat.filter((a) => a.isPostingAllowed);
  const revenueOptions: SelectOption[] = postable.filter((a) => a.groupCode === 4).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const inventoryOptions: SelectOption[] = postable.filter((a) => a.groupCode === 1).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const cogsOptions: SelectOption[] = postable.filter((a) => a.groupCode === 5 || a.groupCode === 6).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const categoryOptions: SelectOption[] = (categories.data?.data ?? []).map((c: any) => ({ value: c.id, label: c.name }));
  const productList: any[] = products.data.data ?? [];
  const rows = productList.map((p: any) => ({ id: p.id, sku: p.sku, name: p.name, type: p.type, stock: p.trackStock ? "Tracked" : "-", value: "" }));

  const defaultValues: ProductForm = editing
    ? { type: editing.type, sku: editing.sku, name: editing.name, revenueAccountId: editing.revenueAccountId ?? "", categoryId: editing.categoryId ?? "", inventoryAccountId: editing.inventoryAccountId ?? "", cogsAccountId: editing.cogsAccountId ?? "" }
    : { type: "PHYSICAL", sku: "", name: "", revenueAccountId: "", categoryId: "", inventoryAccountId: "", cogsAccountId: "" };

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Inventory" title="Products" description="Product setup, pricing, stock tracking, digital provider mapping, and account linkage through InventoryService." /><SplitWorkspace main={<><GlassPanel>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">{editing ? `Edit product · ${editing.sku}` : "New product"}</h2>{editing ? <button type="button" onClick={() => setEditing(null)} className="h-8 rounded-md border border-border px-3 text-xs">Cancel edit</button> : null}</div>
    <ManagedForm<ProductForm> key={editing?.id ?? "new"} schema={schema} defaultValues={defaultValues} onSubmit={async (values) => { const payload: Record<string, unknown> = { type: values.type, sku: values.sku, name: values.name, revenueAccountId: values.revenueAccountId }; payload.categoryId = values.categoryId || undefined; payload.inventoryAccountId = values.inventoryAccountId || undefined; payload.cogsAccountId = values.cogsAccountId || undefined; if (editing) { await updateMutation.mutateAsync({ ...(payload as ProductForm), productId: editing.id }); setEditing(null); } else { await createMutation.mutateAsync(payload); } }}>{() => <div className="grid gap-4 md:grid-cols-2"><RhfDataSelect<ProductForm> name="type" label="Type" options={[{ value: "PHYSICAL", label: "Physical" }, { value: "DIGITAL", label: "Digital" }, { value: "SERVICE", label: "Service" }]} placeholder="Pilih tipe" /><RhfTextField<ProductForm> name="sku" label="SKU" placeholder="SKU-001" /><RhfTextField<ProductForm> name="name" label="Name" placeholder="Product name" /><RhfDataSelect<ProductForm> name="categoryId" label="Category (opsional)" options={categoryOptions} placeholder="Pilih kategori" /><RhfDataSelect<ProductForm> name="revenueAccountId" label="Revenue account" options={revenueOptions} placeholder="Pilih akun pendapatan" /><RhfDataSelect<ProductForm> name="inventoryAccountId" label="Inventory account (wajib untuk fisik)" options={inventoryOptions} placeholder="Pilih akun persediaan" /><RhfDataSelect<ProductForm> name="cogsAccountId" label="COGS account (wajib untuk fisik)" options={cogsOptions} placeholder="Pilih akun HPP" /><button type="submit" className="h-10 self-end rounded-md bg-foreground px-4 text-sm font-medium text-background">{editing ? "Update product" : "Save product"}</button></div>}</ManagedForm></GlassPanel><GlassTable columns={[{ key: "sku", header: "SKU" }, { key: "name", header: "Name" }, { key: "type", header: "Type" }, { key: "stock", header: "Stock" }, { key: "value", header: "Value" }, { key: "actions", header: "Actions", render: (row: any) => <button type="button" onClick={() => setEditing(productList.find((p) => p.id === row.id) ?? null)} className="h-8 rounded-md border border-border px-3 text-xs">Edit</button> }]} rows={rows} empty="No products loaded" /></>} side={<><DetailPanel title="Account mapping">Revenue account wajib. Inventory/COGS dipakai saat tracking stok dan posting HPP.</DetailPanel><DetailPanel title="Traceability">Movement, cost history, and journal source tracing open from row drawers.</DetailPanel></>} /></div>;
}
