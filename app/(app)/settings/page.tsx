"use client";

import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ManagedForm, RhfDataSelect, RhfTextField, type SelectOption } from "@/components/forms/rhf-form";
import { usePostMutation, useListQuery } from "@/presentation/query/dashboard-hooks";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassDataSelect } from "@/components/forms/glass-form";
import { apiRequest } from "@/presentation/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  name: z.string().min(3),
  fiscalYearStart: z.string().regex(/^([1-9]|1[0-2])$/, "Bulan 1-12"),
  npwpNumber: z.string().optional(),
  address: z.string().optional(),
});
type SettingsForm = z.infer<typeof schema>;

const MONTHS: SelectOption[] = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
  .map((label, i) => ({ value: String(i + 1), label: `${i + 1} - ${label}` }));

function DefaultContactSection({ currentSettings }: { currentSettings: any }) {
  const qc = useQueryClient();
  const contacts = useQuery({
    queryKey: ["contacts-all"],
    queryFn: () => apiRequest<{ data: any[] }>("/api/contacts?q="),
    staleTime: 60_000,
  });

  const allContacts: any[] = contacts.data?.data ?? [];
  const contactOptions = allContacts.map((c) => ({
    value: c.id,
    label: c.category === "INSTANSI"
      ? `${c.name}${c.picName ? ` (PJ: ${c.picName})` : ""}`
      : c.name,
  }));

  const [custId, setCustId]   = useState<string>(currentSettings?.defaultCustomerContactId ?? "");
  const [vendorId, setVendorId] = useState<string>(currentSettings?.defaultVendorContactId  ?? "");
  const [saving, setSaving]   = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiRequest("/api/settings", {
        method: "POST",
        body: JSON.stringify({
          settings: {
            ...currentSettings,
            defaultCustomerContactId: custId   || null,
            defaultVendorContactId:   vendorId || null,
          },
        }),
      });
      toast.success("Kontak default disimpan.");
      void qc.invalidateQueries({ queryKey: ["settings", "business"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-semibold">Kontak Default Transaksi</p>
        <p className="mt-0.5 text-xs text-muted">
          Kontak ini otomatis dipilih saat membuat transaksi baru. Bisa diubah per transaksi.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs text-muted">Default Pelanggan (Penjualan)</span>
          <GlassDataSelect
            value={custId}
            onChange={setCustId}
            placeholder="Pilih pelanggan default…"
            options={[{ value: "", label: "— Tidak ada default —" }, ...contactOptions]}
            className="h-9"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted">Default Vendor/Supplier (Pembelian)</span>
          <GlassDataSelect
            value={vendorId}
            onChange={setVendorId}
            placeholder="Pilih vendor default…"
            options={[{ value: "", label: "— Tidak ada default —" }, ...contactOptions]}
            className="h-9"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || contacts.isLoading}
        className="h-9 w-fit rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
      >
        {saving ? "Menyimpan…" : "Simpan kontak default"}
      </button>
    </div>
  );
}

function SessionRevokeSection() {
  const [loading, setLoading] = useState(false);

  async function revokeOthers() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Gagal.");
      toast.success(`${json.data?.deleted ?? 0} sesi lain berhasil diakhiri.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    } finally { setLoading(false); }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border p-4">
      <div>
        <p className="text-sm font-medium">Keamanan Sesi</p>
        <p className="mt-1 text-xs text-muted">Akhiri semua sesi aktif di perangkat lain. Sesi ini tetap aktif.</p>
      </div>
      <button type="button" onClick={revokeOthers} disabled={loading}
        className="h-9 w-fit rounded-md border border-danger/60 px-4 text-sm text-danger hover:bg-danger/5 disabled:opacity-50">
        {loading ? "Mengakhiri sesi…" : "Keluar dari semua perangkat lain"}
      </button>
    </div>
  );
}

export default function Page() {
  const mutation = usePostMutation("/api/settings");
  const { data, isLoading } = useListQuery<any>("/api/settings", ["settings", "business"]);

  const biz = (data as any)?.data ?? data;

  if (isLoading) return <GlassSkeleton className="h-72" />;

  const defaultValues: SettingsForm = {
    name: biz?.name ?? "",
    fiscalYearStart: String(biz?.fiscalYearStart ?? "1"),
    npwpNumber: biz?.npwpNumber ?? "",
    address: biz?.address ?? "",
  };

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Settings"
        title="Pengaturan Usaha"
        description={`Profil dan preferensi untuk ${biz?.name ?? "usaha ini"}.`}
      />
      <SplitWorkspace
        main={
          <div className="grid gap-6">
            <ManagedForm<SettingsForm>
              key={biz?.id}
              schema={schema}
              defaultValues={defaultValues}
              onSubmit={async (values) => {
                const payload: Record<string, unknown> = { name: values.name, fiscalYearStart: Number(values.fiscalYearStart) };
                if (values.npwpNumber) payload.npwpNumber = values.npwpNumber;
                if (values.address) payload.address = values.address;
                await mutation.mutateAsync(payload);
              }}
            >
              {() => (
                <div className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2">
                  <RhfTextField<SettingsForm> name="name" label="Nama usaha" placeholder="Nama usaha" />
                  <RhfDataSelect<SettingsForm> name="fiscalYearStart" label="Awal tahun fiskal" options={MONTHS} placeholder="Pilih bulan" />
                  <RhfTextField<SettingsForm> name="npwpNumber" label="NPWP (opsional)" placeholder="00.000.000.0-000.000" />
                  <RhfTextField<SettingsForm> name="address" label="Alamat (opsional)" placeholder="Alamat usaha" />
                  <button type="submit" className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background md:col-span-2">
                    Simpan pengaturan
                  </button>
                </div>
              )}
            </ManagedForm>
            <DefaultContactSection currentSettings={biz?.settings ?? {}} />
            <SessionRevokeSection />
          </div>
        }
        side={
          <>
            <DetailPanel title="Nama & profil">Nama usaha ditampilkan di seluruh aplikasi dan laporan.</DetailPanel>
            <DetailPanel title="Awal tahun fiskal">Menentukan kapan periode fiskal dimulai setiap tahun. Ubah hanya di awal setup.</DetailPanel>
            <DetailPanel title="Currency">Mata uang dikunci ke IDR di versi ini.</DetailPanel>
          </>
        }
      />
    </div>
  );
}
