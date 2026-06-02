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
  if (error || !data) return <GlassErrorState title="Vendors unavailable" description="Unable to load vendors." />;
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="AR/AP" title="Vendors" description="Master data maintained through ArApService and reused by invoices, bills, payments, and aging reports." /><SplitWorkspace main={<GlassTable columns={[{ key: "name", header: "Name" }, { key: "email", header: "Email" }, { key: "phone", header: "Phone" }, { key: "address", header: "Address" }, { key: "status", header: "Status" }]} rows={data.data} empty="No vendors loaded" />} side={<><GlassPanel><ManagedForm<VendorForm> schema={schema} defaultValues={{ name: "", email: "", phone: "", address: "" }} onSubmit={async (values) => { const payload: Record<string, unknown> = { name: values.name }; if (values.email) payload.email = values.email; if (values.phone) payload.phone = values.phone; if (values.address) payload.address = values.address; await mutation.mutateAsync(payload); }}>{() => <div className="grid gap-4"><RhfTextField<VendorForm> name="name" label="Vendor name" placeholder="PT Pemasok" /><RhfTextField<VendorForm> name="email" label="Email" placeholder="email@contoh.id" /><RhfTextField<VendorForm> name="phone" label="Phone" placeholder="0812..." /><RhfTextField<VendorForm> name="address" label="Address" placeholder="Alamat" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background">Save vendor</button></div>}</ManagedForm></GlassPanel><DetailPanel title="Profile drawer">Contact detail, statement, and transaction history open in a drawer.</DetailPanel></>} /></div>;
}
