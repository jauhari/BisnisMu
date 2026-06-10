"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { apiRequest } from "@/presentation/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRupiah } from "@/presentation/format/number";
import { MoneyField } from "@/components/forms/financial-inputs";
import { X, Plus, UserPlus, Building2, User, Trash2, Send, Undo2, FileText, Edit3 } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleItem {
  id: string;
  revenueAccountId: string;
  description: string;
  amount: string;
  contacts: ContactTag[];
}

interface ContactTag {
  contactId: string;
  name: string;
  category: "INDIVIDUAL" | "INSTANSI";
  amount: string;
  notes: string;
}

interface Contact {
  id: string;
  name: string;
  category: "INDIVIDUAL" | "INSTANSI";
  picName?: string | null;
  phone?: string | null;
  totalVisits: number;
  totalRevenue: string;
}

function uid() { return Math.random().toString(36).slice(2); }

function flattenAccounts(nodes: any[]): any[] {
  return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]);
}

type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "CASHIER" | "VIEWER";
function canMutate(role?: Role) { return role === "OWNER" || role === "ADMIN" || role === "CASHIER"; }
function canDelete(role?: Role) { return role === "OWNER" || role === "ADMIN"; }
function canVoid(role?: Role) { return role === "OWNER" || role === "ADMIN"; }
function canHardMutate(role?: Role, hardMutation?: boolean) { return Boolean(hardMutation && (role === "OWNER" || role === "ADMIN" || role === "ACCOUNTANT")); }

// ─── ContactSearch — inline search + tambah baru ──────────────────────────────

function ContactSearch({ onAdd }: { onAdd: (c: ContactTag) => void }) {
  const [q, setQ] = useState("");
  const [showNew,   setShowNew]   = useState(false);
  const [showDrop,  setShowDrop]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [newCategory, setNewCategory] = useState<"INDIVIDUAL" | "INSTANSI">("INDIVIDUAL");
  const [newPic,    setNewPic]    = useState("");
  const [newPhone,  setNewPhone]  = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDrop(false);
        setShowNew(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useQuery({
    queryKey: ["contacts-search", q],
    queryFn: () => apiRequest<{ data: Contact[] }>(`/api/contacts?q=${encodeURIComponent(q)}`),
    enabled: q.length >= 1, // hanya fetch saat ada input
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest<{ data: Contact }>("/api/contacts", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["contacts-search"] }); },
  });

  const contacts: Contact[] = search.data?.data ?? [];

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const res = await createMutation.mutateAsync({
        name: newName.trim(),
        category: newCategory,
        picName: newCategory === "INSTANSI" ? newPic.trim() || undefined : undefined,
        phone: newPhone.trim() || undefined,
      });
      const c = res.data;
      onAdd({ contactId: c.id, name: c.name, category: c.category, amount: "", notes: "" });
      setShowNew(false); setNewName(""); setNewPic(""); setNewPhone(""); setQ("");
    } catch {
      toast.error("Gagal membuat kontak.");
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <GlassInput
          value={q}
          onChange={(e) => { setQ(e.target.value); setShowDrop(true); setShowNew(false); }}
          onFocus={() => { if (q.length >= 1) setShowDrop(true); }}
          placeholder="Cari kontak (nama / HP)…"
          className="h-8 text-xs"
        />
        <button
          type="button"
          onClick={() => { setShowNew(true); setQ(""); }}
          className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted hover:text-foreground"
          title="Tambah kontak baru"
        >
          <UserPlus className="h-3.5 w-3.5" /> Baru
        </button>
      </div>

      {/* Hasil pencarian */}
      {!showNew && showDrop && contacts.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-background shadow-xl">
          {contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onAdd({ contactId: c.id, name: c.name, category: c.category, amount: "", notes: "" }); setQ(""); setShowDrop(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/60 dark:hover:bg-white/8"
            >
              {c.category === "INSTANSI"
                ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                : <User className="h-3.5 w-3.5 shrink-0 text-muted" />}
              <span className="flex-1 truncate">{c.name}{c.picName ? ` (PJ: ${c.picName})` : ""}</span>
              {c.phone ? <span className="text-xs text-muted">{c.phone}</span> : null}
              <span className="text-xs text-muted">{c.totalVisits}× kunjungan</span>
            </button>
          ))}
        </div>
      )}

      {/* Form tambah baru */}
      {showNew && (
        <div className="mt-2 rounded-xl border border-border bg-white/80 p-3 dark:bg-surface/90 space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Kontak Baru</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewCategory("INDIVIDUAL")}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs ${newCategory === "INDIVIDUAL" ? "bg-accent text-white" : "border border-border text-muted"}`}
            >
              <User className="h-3 w-3" /> Individu
            </button>
            <button
              type="button"
              onClick={() => setNewCategory("INSTANSI")}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-xs ${newCategory === "INSTANSI" ? "bg-accent text-white" : "border border-border text-muted"}`}
            >
              <Building2 className="h-3 w-3" /> Instansi
            </button>
          </div>
          <GlassInput
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={newCategory === "INSTANSI" ? "Nama instansi / organisasi" : "Nama lengkap"}
            className="h-8 text-xs"
          />
          {newCategory === "INSTANSI" && (
            <GlassInput
              value={newPic}
              onChange={(e) => setNewPic(e.target.value)}
              placeholder="Nama penanggung jawab (PJ)"
              className="h-8 text-xs"
            />
          )}
          <GlassInput
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="No. HP (opsional)"
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || createMutation.isPending}
              className="h-7 rounded-md bg-foreground px-3 text-xs text-background disabled:opacity-40"
            >
              {createMutation.isPending ? "Menyimpan…" : "Simpan & Tambahkan"}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="h-7 rounded-md border border-border px-3 text-xs text-muted">
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Halaman Utama ────────────────────────────────────────────────────────────

export default function Page() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const dailyList = useQuery({
    queryKey: ["list", "daily-sales"],
    queryFn: () => apiRequest<{ data: any[] }>("/api/sales/daily/list"),
  });
  const salesOrders = useQuery({
    queryKey: ["list", "formal-sales-orders"],
    queryFn: () => apiRequest<{ data: { rows: any[]; total: number } }>("/api/sales/orders/list"),
  });
  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiRequest<{ data: { role: Role; hardMutation: boolean } }>("/api/auth/me"),
  });
  const settings = useQuery({
    queryKey: ["settings", "business"],
    queryFn: () => apiRequest<{ data: any }>("/api/settings"),
    staleTime: 5 * 60_000,
  });

  const bizSettings  = (settings.data as any)?.data?.settings ?? {};
  const defaultCustId: string = bizSettings?.defaultCustomerContactId ?? "";
  const role = me.data?.data?.role;
  const hardMutation = Boolean(me.data?.data?.hardMutation);

  const flat = flattenAccounts(accounts.data?.data ?? []);
  const revenueOptions = flat.filter((a) => a.groupCode === 4 && a.isPostingAllowed); // 4 = REVENUE
  const cashOptions    = flat.filter((a) => a.groupCode === 1 && a.isPostingAllowed && String(a.code).startsWith("11")); // 11xxxx = Aset Lancar (Kas & Bank)

  const [saleDate,     setSaleDate]     = useState(() => new Date().toLocaleDateString("en-CA"));
  const [cashAccountId,setCashAccountId] = useState("");
  const [description,  setDescription]  = useState("");
  const [items,        setItems]        = useState<SaleItem[]>([
    { id: uid(), revenueAccountId: "", description: "", amount: "", contacts: [] },
  ]);
  const [editingDailySaleId, setEditingDailySaleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-fill kas ke Kas Waterbyuur kalau ada
  useEffect(() => {
    if (!cashAccountId && cashOptions.length) {
      const kas = cashOptions.find((a) => a.code === "110101") ?? cashOptions[0];
      if (kas) setCashAccountId(kas.id);
    }
  }, [cashOptions.length]);

  // Auto-load default pelanggan dari settings ke item pertama
  useEffect(() => {
    if (!defaultCustId || !settings.isSuccess) return;
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== 0) return item;
      if (item.contacts.find((c) => c.contactId === defaultCustId)) return item;
      // Fetch nama kontak dari daftar kontak (jika sudah di-cache)
      const cachedContacts: any[] = (qc.getQueryData(["contacts-search", ""]) as any)?.data ?? [];
      const found = cachedContacts.find((c: any) => c.id === defaultCustId);
      const tag: ContactTag = {
        contactId: defaultCustId,
        name: found?.name ?? "Pelanggan Default",
        category: found?.category ?? "INDIVIDUAL",
        amount: "",
        notes: "",
      };
      return { ...item, contacts: [tag] };
    }));
  }, [defaultCustId, settings.isSuccess]);

  useEffect(() => {
    const dailySaleId = searchParams.get("dailySaleId");
    if (!dailySaleId || !dailyList.data?.data?.length || editingDailySaleId === dailySaleId) return;
    const sale = dailyList.data.data.find((row: any) => row.id === dailySaleId);
    if (sale) loadDailySaleForEdit(sale);
  }, [searchParams, dailyList.data, editingDailySaleId]);

  const totalAmount = items.reduce((s, it) => s + (parseInt(it.amount) || 0), 0);

  function updateItem(id: string, patch: Partial<SaleItem>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  function addContact(itemId: string, tag: ContactTag) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      if (it.contacts.find((c) => c.contactId === tag.contactId)) return it;
      return { ...it, contacts: [...it.contacts, tag] };
    }));
  }

  function removeContact(itemId: string, contactId: string) {
    setItems((prev) => prev.map((it) =>
      it.id !== itemId ? it : { ...it, contacts: it.contacts.filter((c) => c.contactId !== contactId) }
    ));
  }

  function loadDailySaleForEdit(sale: any) {
    setEditingDailySaleId(sale.id);
    setSaleDate(new Date(sale.saleDate).toLocaleDateString("en-CA"));
    setCashAccountId(sale.cashAccountId);
    setDescription(sale.description ?? "");
    setItems((sale.items ?? []).map((item: any): SaleItem => ({
      id: item.id ?? uid(),
      revenueAccountId: item.revenueAccountId,
      description: item.description ?? "",
      amount: String(item.amount ?? ""),
      contacts: (item.contacts ?? []).map((entry: any): ContactTag => ({
        contactId: entry.contactId,
        name: entry.contact?.name ?? "Kontak",
        category: entry.contact?.category ?? "INDIVIDUAL",
        amount: entry.amount != null ? String(entry.amount) : "",
        notes: entry.notes ?? "",
      })),
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDailySaleForm() {
    setEditingDailySaleId(null);
    setItems([{ id: uid(), revenueAccountId: "", description: "", amount: "", contacts: [] }]);
    setDescription("");
  }

  async function submit() {
    if (!cashAccountId) { toast.error("Pilih akun kas terlebih dahulu."); return; }
    const valid = items.filter((it) => it.revenueAccountId && parseInt(it.amount) > 0);
    if (!valid.length) { toast.error("Minimal 1 item dengan akun pendapatan dan nominal."); return; }

    setSaving(true);
    try {
      const payload = {
        saleDate,
        cashAccountId,
        description: description || undefined,
        items: valid.map((it) => ({
          revenueAccountId: it.revenueAccountId,
          description:      it.description || undefined,
          amount:           parseInt(it.amount),
          contacts:         it.contacts.map((c) => ({
            contactId: c.contactId,
            amount:    parseInt(c.amount) || undefined,
            notes:     c.notes || undefined,
          })),
        })),
      };
      await apiRequest(editingDailySaleId ? `/api/sales/daily/${editingDailySaleId}` : "/api/sales/daily", {
        method: editingDailySaleId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...payload,
        }),
      });
      toast.success(editingDailySaleId ? "Penjualan diperbarui." : "Penjualan tersimpan & jurnal dibuat otomatis.");
      void qc.invalidateQueries({ queryKey: ["list", "daily-sales"] });
      resetDailySaleForm();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function rowAction(kind: "daily-delete" | "daily-void" | "sales-confirm" | "sales-delete" | "sales-void", row: any) {
    try {
      if (kind === "daily-delete") {
        await apiRequest(`/api/sales/daily/${row.saleId}`, { method: "DELETE" });
        toast.success("Penjualan harian dihapus.");
        await dailyList.refetch();
      }
      if (kind === "daily-void") {
        await apiRequest(`/api/sales/daily/${row.saleId}`, { method: "DELETE", body: JSON.stringify({ reason: `Void penjualan harian ${row.saleId}` }) });
        toast.success("Penjualan harian dibatalkan.");
        await dailyList.refetch();
      }
      if (kind === "sales-confirm") {
        await apiRequest("/api/sales/orders/confirm", { method: "POST", body: JSON.stringify({ salesOrderId: row.id }) });
        toast.success("Sales order dikonfirmasi.");
        await salesOrders.refetch();
      }
      if (kind === "sales-delete") {
        await apiRequest(`/api/sales/orders/${row.id}`, { method: "DELETE" });
        toast.success("Draft sales order dihapus.");
        await salesOrders.refetch();
      }
      if (kind === "sales-void") {
        await apiRequest(`/api/sales/orders/${row.id}/void`, { method: "POST", body: JSON.stringify({ reason: `Void sales order ${row.salesNumber}` }) });
        toast.success("Sales order dibatalkan.");
        await salesOrders.refetch();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aksi gagal.");
    }
  }

  if (accounts.isLoading) return <GlassSkeleton className="h-72" />;
  if (accounts.error) return <GlassErrorState title="Gagal memuat akun" description="Coba refresh halaman." />;

  const listRows = (dailyList.data?.data ?? []).flatMap((sale: any) =>
    (sale.items ?? []).map((item: any) => ({
      saleId:   sale.id,
      status:   sale.status ?? "POSTED",
      tanggal:  new Date(sale.saleDate).toLocaleDateString("id-ID"),
      kas:      `${sale.cashAccount?.code} | ${sale.cashAccount?.name}`,
      akun:     `${item.revenueAccount?.code} | ${item.revenueAccount?.name}`,
      keterangan: item.description ?? sale.description ?? "-",
      nominal:  Number(item.amount).toLocaleString("id-ID"),
      kontak:   item.contacts?.map((c: any) => c.contact?.name).filter(Boolean).join(", ") || "-",
      rawSale: sale,
    }))
  );
  const orderRows = (salesOrders.data?.data?.rows ?? []).map((order: any) => ({
    ...order,
    tanggal: new Date(order.saleDate).toLocaleDateString("id-ID"),
    total: String(order.totalAmount),
    paid: String(order.paidAmount),
    itemCount: order.items?.length ?? 0,
  }));

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Sales"
        title="Penjualan Harian"
        description="Catat pendapatan harian. Jurnal dibuat otomatis — Debit Kas, Kredit Pendapatan."
      />

      <div className="relative z-10">
      <GlassPanel>
        <div className="grid gap-4">
          {/* Header */}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs text-muted">Tanggal</span>
              <GlassDatePicker value={saleDate} onChange={setSaleDate} className="h-10" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted">Uang masuk ke (Kas)</span>
              <GlassDataSelect
                value={cashAccountId}
                onChange={setCashAccountId}
                placeholder="Pilih akun kas…"
                options={cashOptions.map((a) => ({ value: a.id, label: `${a.code} | ${a.name}` }))}
                className="h-10"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted">Keterangan (opsional)</span>
              <GlassInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Penjualan harian" className="h-10" />
            </label>
          </div>

          {/* Items */}
          <div className="grid gap-3">
            {items.map((item, idx) => (
              <div key={item.id} className="rounded-xl border border-border/70 p-3 space-y-3">
                {/* Baris utama item */}
                <div className="grid items-end gap-2 md:grid-cols-[2fr_2fr_1fr_auto]">
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Akun Pendapatan</span>
                    <GlassDataSelect
                      value={item.revenueAccountId}
                      onChange={(v) => updateItem(item.id, { revenueAccountId: v })}
                      placeholder="Pilih akun pendapatan…"
                      options={revenueOptions.map((a) => ({ value: a.id, label: `${a.code} | ${a.name}` }))}
                      className="h-9"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Keterangan</span>
                    <GlassInput
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="opsional"
                      className="h-9"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs text-muted">Nominal (Rp)</span>
                    <MoneyField
                      value={item.amount}
                      onChange={(raw) => updateItem(item.id, { amount: raw })}
                      className="h-9 rounded-md border border-border bg-white/60 px-2 text-sm dark:bg-white/8"
                      placeholder="0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                    disabled={items.length <= 1}
                    className="mb-0.5 h-9 rounded-md border border-border px-2 text-muted hover:text-danger disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Kontak untuk item ini */}
                <div className="space-y-2">
                  {item.contacts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.contacts.map((c) => (
                        <div key={c.contactId} className="flex items-center gap-1.5 rounded-full border border-border bg-white/60 px-3 py-1 text-xs dark:bg-white/8">
                          {c.category === "INSTANSI"
                            ? <Building2 className="h-3 w-3 text-muted" />
                            : <User className="h-3 w-3 text-muted" />}
                          <span>{c.name}</span>
                          <button type="button" onClick={() => removeContact(item.id, c.contactId)} className="ml-0.5 text-muted hover:text-danger">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <ContactSearch onAdd={(tag) => addContact(item.id, tag)} />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const defaultContacts: ContactTag[] = defaultCustId ? [{
                  contactId: defaultCustId,
                  name: (qc.getQueryData(["contacts-search", ""]) as any)?.data?.find((c: any) => c.id === defaultCustId)?.name ?? "Pelanggan Default",
                  category: "INDIVIDUAL",
                  amount: "",
                  notes: "",
                }] : [];
                setItems((prev) => [...prev, { id: uid(), revenueAccountId: "", description: "", amount: "", contacts: defaultContacts }]);
              }}
              className="flex h-9 items-center gap-1 rounded-md border border-border px-4 text-sm"
            >
              <Plus className="h-4 w-4" /> Tambah item
            </button>
            <div className="flex items-center gap-4">
              {totalAmount > 0 && (
                <span className="text-sm text-muted">
                  Total: <strong className="text-foreground tabular-nums">{formatRupiah(totalAmount)}</strong>
                </span>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="h-9 rounded-md bg-foreground px-5 text-sm font-medium text-background disabled:opacity-50"
              >
                {saving ? "Menyimpan…" : editingDailySaleId ? "Simpan Perubahan" : "Simpan & Buat Jurnal"}
              </button>
              {editingDailySaleId ? <button type="button" onClick={resetDailySaleForm} className="h-9 rounded-md border border-border px-4 text-sm text-muted">Batal edit</button> : null}
            </div>
          </div>
        </div>
      </GlassPanel>
      </div>

      {/* Riwayat penjualan */}
      <GlassTable
        tableId="daily-sales-list"
        columns={[
          { key: "tanggal",    header: "Tanggal" },
          { key: "status",     header: "Status" },
          { key: "akun",       header: "Akun Pendapatan" },
          { key: "keterangan", header: "Keterangan" },
          { key: "nominal",    header: "Nominal", render: (r: any) => r.nominal },
          { key: "kontak",     header: "Kontak" },
          { key: "actions",    header: "Aksi", render: (r: any) => <div className="flex flex-wrap gap-1.5"><button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => toast.info(`${r.tanggal}: ${r.keterangan}`)}><FileText className="inline h-3 w-3" /> Detail</button>{r.status !== "VOID" && canHardMutate(role, hardMutation) ? <button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => loadDailySaleForEdit(r.rawSale)}><Edit3 className="inline h-3 w-3" /> Edit</button> : null}{r.status !== "VOID" && canHardMutate(role, hardMutation) ? <button type="button" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger" onClick={() => void rowAction("daily-delete", r)}><Trash2 className="inline h-3 w-3" /> Delete</button> : null}{r.status !== "VOID" && canVoid(role) && !hardMutation ? <button type="button" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger" onClick={() => void rowAction("daily-void", r)}><Undo2 className="inline h-3 w-3" /> Void</button> : null}</div> },
        ]}
        rows={listRows}
        empty="Belum ada data penjualan."
      />

      <GlassTable
        tableId="formal-sales-orders-list"
        columns={[
          { key: "salesNumber", header: "No. Order" },
          { key: "tanggal", header: "Tanggal" },
          { key: "status", header: "Status" },
          { key: "description", header: "Keterangan" },
          { key: "itemCount", header: "Item" },
          { key: "total", header: "Total" },
          { key: "paid", header: "Terbayar" },
          { key: "actions", header: "Aksi", render: (r: any) => <div className="flex flex-wrap gap-1.5"><button type="button" className="rounded border border-border px-2 py-1 text-xs" onClick={() => toast.info(`${r.salesNumber}: ${r.description}`)}><FileText className="inline h-3 w-3" /> Detail</button>{r.status === "DRAFT" && canMutate(role) ? <button type="button" className="rounded bg-foreground px-2 py-1 text-xs text-background" onClick={() => void rowAction("sales-confirm", r)}><Send className="inline h-3 w-3" /> Confirm</button> : null}{r.status === "DRAFT" && canDelete(role) ? <button type="button" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger" onClick={() => void rowAction("sales-delete", r)}><Trash2 className="inline h-3 w-3" /> Delete</button> : null}{r.status !== "DRAFT" && r.status !== "VOID" && canVoid(role) ? <button type="button" className="rounded border border-danger/40 px-2 py-1 text-xs text-danger" onClick={() => void rowAction("sales-void", r)}><Undo2 className="inline h-3 w-3" /> Void</button> : null}</div> },
        ]}
        rows={orderRows}
        empty="Belum ada sales order resmi."
      />
    </div>
  );
}
