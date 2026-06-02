"use client";

import { z } from "zod";
import { ManagedForm, RhfDataSelect, RhfTextField, type SelectOption } from "@/components/forms/rhf-form";
import { usePostMutation } from "@/presentation/query/dashboard-hooks";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";

const schema = z.object({ name: z.string().min(3), fiscalYearStart: z.string().regex(/^([1-9]|1[0-2])$/, "Bulan 1-12"), npwpNumber: z.string().optional(), address: z.string().optional() });
type SettingsForm = z.infer<typeof schema>;

const MONTHS: SelectOption[] = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((label, i) => ({ value: String(i + 1), label: `${i + 1} - ${label}` }));

export default function Page() {
  const mutation = usePostMutation("/api/settings");
  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Settings" title="Business Settings" description="Business profile, fiscal year, and preferences routed through BusinessService." /><SplitWorkspace main={<ManagedForm<SettingsForm> schema={schema} defaultValues={{ name: "Demo AkuntansiMu", fiscalYearStart: "1", npwpNumber: "", address: "" }} onSubmit={async (values) => { const payload: Record<string, unknown> = { name: values.name, fiscalYearStart: Number(values.fiscalYearStart) }; if (values.npwpNumber) payload.npwpNumber = values.npwpNumber; if (values.address) payload.address = values.address; await mutation.mutateAsync(payload); }}>{() => <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2"><RhfTextField<SettingsForm> name="name" label="Business name" placeholder="Business name" /><RhfDataSelect<SettingsForm> name="fiscalYearStart" label="Fiscal year start" options={MONTHS} placeholder="Pilih bulan" /><RhfTextField<SettingsForm> name="npwpNumber" label="NPWP (opsional)" placeholder="00.000.000.0-000.000" /><RhfTextField<SettingsForm> name="address" label="Address (opsional)" placeholder="Alamat usaha" /><button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-2">Save settings</button></div>}</ManagedForm>} side={<><DetailPanel title="Backend contract">Settings call BusinessService.updateSettings and keep fiscal period rules in backend.</DetailPanel><DetailPanel title="Currency">Currency is fixed to IDR in this version.</DetailPanel></>} /></div>;
}
