"use client";

import { z } from "zod";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ManagedForm, RhfTextField, RhfDataSelect, type SelectOption } from "@/components/forms/rhf-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { FormDrawer } from "@/components/layout/form-drawer";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery, usePostMutation, usePatchMutation } from "@/presentation/query/dashboard-hooks";

const schema = z.object({ type: z.enum(["PHYSICAL", "DIGITAL", "SERVICE"]), sku: z.string().min(1), name: z.string().min(2), revenueAccountId: z.string().min(10), categoryId: z.string().optional(), inventoryAccountId: z.string().optional(), cogsAccountId: z.string().optional(), sellPrice: z.string().optional(), buyPrice: z.string().optional(), provider: z.string().optional(), providerSku: z.string().optional(), floatAccountId: z.string().optional() }).superRefine((val, ctx) => {
  if (val.type === "PHYSICAL") {
    if (!val.inventoryAccountId || val.inventoryAccountId.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["inventoryAccountId"], message: "Wajib untuk produk fisik" });
    if (!val.cogsAccountId || val.cogsAccountId.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cogsAccountId"], message: "Wajib untuk produk fisik" });
  }
  if (val.type === "DIGITAL") {
    if (!val.provider) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["provider"], message: "Wajib untuk produk digital" });
    if (!val.providerSku) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["providerSku"], message: "Wajib untuk produk digital" });
    if (!val.floatAccountId || val.floatAccountId.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["floatAccountId"], message: "Wajib untuk produk digital" });
  }
});
type ProductForm = z.infer<typeof schema>;
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }

const SKU_PREFIX = "PRD-";
const SKU_PATTERN = /^PRD-(\d+)$/;
/** Suggests the next sequential SKU (e.g. PRD-0001), skipping any number already used by an existing product or floor. */
function nextSku(products: any[], floor: number): string {
  const maxExisting = products.reduce((max, p) => { const m = SKU_PATTERN.exec(String(p.sku ?? "")); return m ? Math.max(max, Number(m[1])) : max; }, 0);
  const next = Math.max(maxExisting, floor) + 1;
  return SKU_PREFIX + String(next).padStart(4, "0");
}

export default function Page() {
  const createMutation = usePostMutation("/api/inventory/products", ["list", "inventory-products"]);
  const updateMutation = usePatchMutation<ProductForm & { productId: string }>((payload) => `/api/inventory/products/${payload.productId}`);
  const products = useListQuery<any[]>("/api/inventory/products", ["list", "inventory-products"]);
  const categories = useListQuery<any[]>("/api/inventory/categories", ["list", "inventory-categories"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const floats = useListQuery<any[]>("/api/float/accounts", ["list", "float-accounts"]);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const [editing, setEditing] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastCreatedNum, setLastCreatedNum] = useState(0);
  const suggestedSku = useMemo(() => nextSku(products.data?.data ?? [], lastCreatedNum), [products.data, lastCreatedNum]);
  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (product: any) => { setEditing(product); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  if (products.isLoading || accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (products.error || !products.data) return <GlassErrorState title="Products unavailable" description="Unable to load products." />;

  const postable = flat.filter((a) => a.isPostingAllowed);
  const revenueOptions: SelectOption[] = postable.filter((a) => a.groupCode === 4).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const inventoryOptions: SelectOption[] = postable.filter((a) => a.groupCode === 1).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const cogsOptions: SelectOption[] = postable.filter((a) => a.groupCode === 5 || a.groupCode === 6).map((a) => ({ value: a.id, label: `${a.code} ${a.name}` }));
  const categoryOptions: SelectOption[] = (categories.data?.data ?? []).map((c: any) => ({ value: c.id, label: c.name }));
  const floatOptions: SelectOption[] = (floats.data?.data ?? []).map((f: any) => ({ value: f.id, label: `${f.provider} · ${f.name}` }));
  const providerOptions: SelectOption[] = [{ value: "SHOPEEPAY", label: "ShopeePay" }, { value: "BUKUWARUNG", label: "BukuWarung" }, { value: "FASTPAY", label: "Fastpay" }, { value: "PAYFAZZ", label: "Payfazz" }, { value: "LINKAJA", label: "LinkAja" }, { value: "CUSTOM", label: "Custom" }];
  const productList: any[] = products.data.data ?? [];
  const rows = productList.map((p: any) => ({ id: p.id, sku: p.sku, name: p.name, type: p.type, stock: p.trackStock ? "Tracked" : "-", value: p.sellPrice ? "Rp " + Number(p.sellPrice).toLocaleString("id-ID") : "-" }));

  const defaultValues: ProductForm = editing
    ? { type: editing.type, sku: editing.sku, name: editing.name, revenueAccountId: editing.revenueAccountId ?? "", categoryId: editing.categoryId ?? "", inventoryAccountId: editing.inventoryAccountId ?? "", cogsAccountId: editing.cogsAccountId ?? "", sellPrice: editing.sellPrice ? String(editing.sellPrice) : "", buyPrice: "", provider: "", providerSku: "", floatAccountId: "" }
    : { type: "PHYSICAL", sku: suggestedSku, name: "", revenueAccountId: "", categoryId: "", inventoryAccountId: "", cogsAccountId: "", sellPrice: "", buyPrice: "", provider: "", providerSku: "", floatAccountId: "" };

  const addButton = <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background"><Plus className="h-4 w-4" />Tambah Produk</button>;

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Inventory" title="Products" description="Product setup, pricing, stock tracking, digital provider mapping, and account linkage through InventoryService." action={addButton} /><SplitWorkspace main={<GlassTable columns={[{ key: "sku", header: "SKU" }, { key: "name", header: "Name" }, { key: "type", header: "Type" }, { key: "stock", header: "Stock" }, { key: "value", header: "Value" }, { key: "actions", header: "Actions", render: (row: any) => <button type="button" onClick={() => openEdit(productList.find((p) => p.id === row.id) ?? null)} className="h-8 rounded-md border border-border px-3 text-xs">Edit</button> }]} rows={rows} empty="Belum ada produk. Klik “Tambah Produk” untuk membuat." />} side={<><DetailPanel title="Account mapping">Revenue account wajib. Inventory/COGS dipakai saat tracking stok dan posting HPP.</DetailPanel><DetailPanel title="Traceability">Movement, cost history, and journal source tracing open from row drawers.</DetailPanel></>} />
    <FormDrawer open={drawerOpen} onClose={closeDrawer} title={editing ? `Edit produk · ${editing.sku}` : "Produk baru"} subtitle={editing ? "Perbarui detail produk." : "Lengkapi detail untuk menambahkan produk."}>
    <ManagedForm<ProductForm> key={editing?.id ?? `new-${suggestedSku}`} schema={schema} defaultValues={defaultValues} onSubmit={async (values) => { const payload: Record<string, unknown> = { type: values.type, sku: values.sku, name: values.name, revenueAccountId: values.revenueAccountId }; payload.categoryId = values.categoryId || undefined; payload.inventoryAccountId = values.inventoryAccountId || undefined; payload.cogsAccountId = values.cogsAccountId || undefined; payload.sellPrice = values.sellPrice ? Number(values.sellPrice) : undefined; payload.buyPrice = values.buyPrice ? Number(values.buyPrice) : undefined; if (values.type === "DIGITAL") { payload.provider = values.provider || undefined; payload.providerSku = values.providerSku || undefined; payload.floatAccountId = values.floatAccountId || undefined; } if (editing) { await updateMutation.mutateAsync({ ...(payload as ProductForm), productId: editing.id }); } else { await createMutation.mutateAsync(payload); const m = SKU_PATTERN.exec(values.sku); if (m) setLastCreatedNum((prev) => Math.max(prev, Number(m[1]))); } closeDrawer(); }}>{({ form }) => { const type = form.watch("type"); return <div className="grid gap-4 sm:grid-cols-2"><RhfDataSelect<ProductForm> name="type" label="Type" options={[{ value: "PHYSICAL", label: "Physical" }, { value: "DIGITAL", label: "Digital" }, { value: "SERVICE", label: "Service" }]} placeholder="Pilih tipe" /><RhfTextField<ProductForm> name="sku" label="SKU (otomatis, bisa diubah)" placeholder="PRD-0001" /><RhfTextField<ProductForm> name="name" label="Name" placeholder="Product name" /><RhfDataSelect<ProductForm> name="categoryId" label="Category (opsional)" options={categoryOptions} placeholder="Pilih kategori" /><RhfTextField<ProductForm> name="sellPrice" label="Harga jual" placeholder="0" type="number" /><RhfTextField<ProductForm> name="buyPrice" label="Harga beli / modal (opsional)" placeholder="0" type="number" /><RhfDataSelect<ProductForm> name="revenueAccountId" label="Revenue account" options={revenueOptions} placeholder="Pilih akun pendapatan" />{type === "PHYSICAL" ? <><RhfDataSelect<ProductForm> name="inventoryAccountId" label="Inventory account (wajib untuk fisik)" options={inventoryOptions} placeholder="Pilih akun persediaan" /><RhfDataSelect<ProductForm> name="cogsAccountId" label="COGS account (wajib untuk fisik)" options={cogsOptions} placeholder="Pilih akun HPP" /></> : null}{type === "DIGITAL" ? <><RhfDataSelect<ProductForm> name="provider" label="Provider rekanan" options={providerOptions} placeholder="Pilih provider" /><RhfTextField<ProductForm> name="providerSku" label="Kode produk di rekanan (providerSku)" placeholder="cth: PULSA10" /><RhfDataSelect<ProductForm> name="floatAccountId" label="Akun saldo rekanan (float)" options={floatOptions} placeholder="Pilih akun float" /></> : null}<button type="submit" className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background sm:col-span-2">{editing ? "Update produk" : "Simpan produk"}</button></div>; }}</ManagedForm>
    </FormDrawer>
  </div>;
}
