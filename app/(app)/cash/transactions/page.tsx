"use client";

import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Edit3, FileText, Landmark, Plus, ReceiptText, Save, Send, Trash2, Undo2, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ManagedForm, RhfDataSelect, RhfDatePicker, RhfMoneyField, RhfTextField, type SelectOption } from "@/components/forms/rhf-form";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { WorkspaceHeader, SplitWorkspace, DetailPanel } from "@/components/layout/workspace";
import { FormDrawer } from "@/components/layout/form-drawer";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery } from "@/presentation/query/dashboard-hooks";

const schema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT", "TRANSFER"]),
  transactionDate: z.string().min(1),
  cashAccountId: z.string().min(10),
  destinationAccountId: z.string().optional(),
  categoryAccountId: z.string().optional(),
  contactId: z.string().optional(),
  amount: z.string().min(1),
  description: z.string().min(3),
});
type CashForm = z.infer<typeof schema>;
type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "CASHIER" | "VIEWER";

const emptyForm = (): CashForm => ({ type: "CASH_OUT", transactionDate: new Date().toISOString().slice(0, 10), cashAccountId: "", destinationAccountId: "", categoryAccountId: "", contactId: "", amount: "", description: "" });

function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }
function canMutate(role?: Role) { return role === "OWNER" || role === "ADMIN" || role === "CASHIER"; }
function canDelete(role?: Role) { return role === "OWNER" || role === "ADMIN"; }
function canVoid(role?: Role) { return role === "OWNER" || role === "ADMIN"; }
function canHardMutate(role?: Role, hardMutation?: boolean) { return Boolean(hardMutation && (role === "OWNER" || role === "ADMIN" || role === "ACCOUNTANT")); }
function digits(value: string) { return value.replace(/\D/g, ""); }
function rowType(type: string) { return type === "CASH_OUT" ? "Pengeluaran" : type === "CASH_IN" ? "Pemasukan" : "Transfer"; }
const CONTACT_TYPE_LABEL: Record<string, string> = { CUSTOMER: "Pelanggan", SUPPLIER: "Pemasok", BOTH: "Pelanggan & Pemasok", OTHER: "Lainnya" };
const CONTACT_TYPE_QUICK_ADD = [{ value: "CUSTOMER", label: "Pelanggan" }, { value: "SUPPLIER", label: "Pemasok" }, { value: "OTHER", label: "Lainnya" }];
const CONTACT_TYPE_HELP: Record<string, string> = { CUSTOMER: "Membeli dari Anda", SUPPLIER: "Anda membeli darinya", OTHER: "Kontak umum" };
function toForm(tx: any): CashForm { return { type: tx.type, transactionDate: tx.transactionDate?.slice?.(0, 10) ?? tx.transactionDate, cashAccountId: tx.cashAccountId, destinationAccountId: tx.destinationAccountId ?? "", categoryAccountId: tx.categoryAccountId ?? "", contactId: tx.contactId ?? "", amount: String(tx.amount), description: tx.description }; }

async function requestJson(url: string, method: string, body?: unknown) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const fieldDetails = json?.fields && typeof json.fields === "object"
      ? Object.entries(json.fields as Record<string, unknown>).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(", ") : String(messages)}`).join("; ")
      : "";
    throw new Error([json?.message ?? json?.error?.message ?? "Aksi gagal.", fieldDetails].filter(Boolean).join(" — "));
  }
  return json;
}

export default function Page() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const list = useListQuery<any[]>("/api/cash/transactions", ["list", "cash-transactions"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const contacts = useListQuery<any[]>("/api/contacts", ["list", "contacts"]);
  const me = useListQuery<{ role: Role }>("/api/auth/me", ["auth", "me"]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [defaults, setDefaults] = useState<CashForm>(() => emptyForm());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactType, setNewContactType] = useState("CUSTOMER");
  const [savingContact, setSavingContact] = useState(false);
  const [seedingCoa, setSeedingCoa] = useState(false);

  const role = (me.data?.data as any)?.role as Role | undefined;
  const hardMutation = Boolean((me.data?.data as any)?.hardMutation);
  const flat = useMemo(() => flattenAccounts(accounts.data?.data ?? []), [accounts.data]);
  const cashOptions: SelectOption[] = flat.filter((a) => (String(a.subtype ?? "").toLowerCase() === "cash" || String(a.subtype ?? "").toLowerCase() === "bank" || String(a.code).startsWith("11")) && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.name}`, code: a.code, name: a.name, groupLabel: "Kas/Bank" }));
  const categoryOptions: SelectOption[] = flat.filter((a) => (a.groupCode === 4 || a.groupCode === 5 || a.groupCode === 6 || a.groupCode === 7) && a.isPostingAllowed).map((a) => ({ value: a.id, label: `${a.name}`, code: a.code, name: a.name, groupLabel: a.groupCode === 4 ? "Pendapatan" : a.groupCode === 5 ? "HPP" : "Beban", normalBalance: a.normalBalance }));
  const contactOptions: SelectOption[] = (contacts.data?.data ?? []).map((c: any) => ({ value: c.id, label: `${c.name} · ${CONTACT_TYPE_LABEL[c.type] ?? c.type}` }));

  function openCreate() { setEditing(null); setDefaults(emptyForm()); setDrawerOpen(true); }
  function openEdit(tx: any) { setEditing(tx); setDefaults(toForm(tx)); setDrawerOpen(true); }

  async function submit(values: CashForm) {
    const payload = { ...values, destinationAccountId: values.destinationAccountId || undefined, categoryAccountId: values.categoryAccountId || undefined, contactId: values.contactId || undefined, amount: digits(values.amount) };
    if (editing) await requestJson(`/api/cash/transactions/${editing.id}`, "PATCH", payload);
    else await requestJson("/api/cash/transactions", "POST", payload);
    await list.refetch?.();
    setDrawerOpen(false);
    setEditing(null);
  }

  async function seedChartOfAccounts() {
    setSeedingCoa(true);
    try {
      const result = await requestJson("/api/accounting/chart-of-accounts/seed", "POST", {});
      await accounts.refetch?.();
      toast.success(result.data?.created ? `${result.data.created} akun SAK EMKM siap dipakai.` : "CoA SAK EMKM sudah siap dipakai.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyiapkan CoA.");
    } finally {
      setSeedingCoa(false);
    }
  }

  async function action(tx: any, kind: "post" | "delete" | "void") {
    setBusyId(tx.id);
    try {
      if (kind === "post") await requestJson("/api/cash/transactions/post", "POST", { transactionId: tx.id });
      if (kind === "delete") await requestJson(`/api/cash/transactions/${tx.id}`, "DELETE");
      if (kind === "void") await requestJson("/api/cash/transactions/void", "POST", { transactionId: tx.id, reason: `Void transaksi ${tx.transactionNumber}` });
      toast.success(kind === "post" ? "Transaksi diposting." : kind === "void" ? "Transaksi dibatalkan." : "Draft dihapus.");
      await list.refetch?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aksi gagal.");
    } finally {
      setBusyId(null);
    }
  }

  const rows = useMemo(() => ((list.data as any)?.data ?? []).map((tx: any) => ({
    ...tx,
    number: tx.transactionNumber,
    typeLabel: rowType(tx.type),
    date: tx.transactionDate?.slice?.(0, 10) ?? tx.transactionDate,
    amountLabel: String(tx.amount),
    memo: tx.description,
  })), [list.data]);

  useEffect(() => {
    const transactionId = searchParams.get("transactionId");
    if (!transactionId || editing?.id === transactionId || !rows.length) return;
    const tx = rows.find((row: any) => row.id === transactionId);
    if (tx) openEdit(tx);
  }, [searchParams, rows, editing?.id]);

  if (accounts.isLoading) return <GlassSkeleton className="h-72" />;

  const addButton = canMutate(role) ? <button type="button" onClick={openCreate} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 sm:w-auto"><Plus className="h-4 w-4" />Tambah draft</button> : null;

  return <div className="grid gap-5 sm:gap-6"><WorkspaceHeader eyebrow="Kas & Bank" title="Transaksi Kas" description="Kelola draft, posting, dan void transaksi kas sesuai role pengguna." action={addButton} /><SplitWorkspace main={<GlassTable selectable={false} tableId="cash-transactions" columns={[{ key: "typeLabel", header: "Tipe" }, { key: "date", header: "Tanggal" }, { key: "status", header: "Status" }, { key: "amountLabel", header: "Nominal", render: (row: any) => <span className={row.type === "CASH_OUT" ? "font-medium text-danger" : "font-medium text-success"}>{Number(row.amountLabel).toLocaleString("id-ID")}</span> }, { key: "memo", header: "Keterangan", render: (row: any) => <div className="min-w-0"><span className="block break-words">{row.memo}</span><span className="mt-1 block break-all text-[11px] font-medium text-muted">{row.number}</span></div> }, { key: "actions", header: "Aksi", render: (row: any) => <div className="flex flex-wrap gap-1.5"><button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium" onClick={() => toast.info(`${row.number}: ${row.memo}`)}><FileText className="h-3.5 w-3.5" /> Detail</button>{((row.status === "DRAFT" && canMutate(role)) || (row.status !== "VOID" && canHardMutate(role, hardMutation))) ? <button type="button" className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium" onClick={() => openEdit(row)}><Edit3 className="h-3.5 w-3.5" /> Edit</button> : null}{row.status === "DRAFT" && canMutate(role) ? <button type="button" disabled={busyId === row.id} className="inline-flex min-h-9 items-center gap-1 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background" onClick={() => void action(row, "post")}><Send className="h-3.5 w-3.5" /> Post</button> : null}{((row.status === "DRAFT" && canDelete(role)) || (row.status !== "VOID" && canHardMutate(role, hardMutation))) ? <button type="button" disabled={busyId === row.id} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs font-medium text-danger" onClick={() => void action(row, "delete")}><Trash2 className="h-3.5 w-3.5" /> Hapus</button> : null}{row.status === "POSTED" && canVoid(role) && !hardMutation ? <button type="button" disabled={busyId === row.id} className="inline-flex min-h-9 items-center gap-1 rounded-md border border-danger/40 px-2.5 py-1.5 text-xs font-medium text-danger" onClick={() => void action(row, "void")}><Undo2 className="h-3.5 w-3.5" /> Void</button> : null}</div> }]} rows={rows} empty="Belum ada transaksi kas. Klik Tambah draft." />} side={<><DetailPanel title="Aturan akses">Kasir bisa membuat, edit, dan posting draft. Void dan delete draft hanya untuk OWNER atau ADMIN. Khusus Hanyukupi, OWNER, ADMIN, ACCOUNTANT dapat edit/delete langsung.</DetailPanel><DetailPanel title="Jejak akuntansi">{hardMutation ? "Mode Hanyukupi aktif: edit posted mengganti jurnal sumber tanpa membuat void journal, dan aksinya tetap diaudit." : "Transaksi posted tidak diedit langsung. Gunakan void agar jurnal pembalik tetap tercatat."}</DetailPanel></>} />
    <FormDrawer open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditing(null); }} title={editing ? "Edit transaksi" : "Tambah draft transaksi"} subtitle={editing && editing.status !== "DRAFT" ? "Mode Hanyukupi: perubahan akan mengganti jurnal sumber tanpa void." : "Simpan sebagai draft dulu, lalu posting saat sudah benar."}>
      <ManagedForm<CashForm> key={editing?.id ?? "new-cash"} schema={schema} defaultValues={defaults} resetOnSuccess={false} onSubmit={submit}>{({ form, submitting }) => {
        const type = form.watch("type");
        const needsCoa = cashOptions.length === 0 || (type !== "TRANSFER" && categoryOptions.length === 0);
        async function saveNewContact() {
          if (!newContactName.trim()) return;
          setSavingContact(true);
          try {
            const result = await requestJson("/api/contacts", "POST", { name: newContactName.trim(), type: newContactType });
            await qc.invalidateQueries({ queryKey: ["list", "contacts"] });
            form.setValue("contactId", result.data.id, { shouldDirty: true, shouldValidate: true });
            setAddingContact(false);
            setNewContactName("");
            toast.success("Kontak ditambahkan.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal menambah kontak.");
          } finally {
            setSavingContact(false);
          }
        }
        const contactFooter = addingContact ? <div className="grid gap-3 p-1">
          <div className="rounded-md border border-accent/20 bg-accent/[0.06] px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Tambah kontak baru</p>
            <p className="mt-0.5 text-xs leading-5 text-muted">Kontak akan langsung dipilih untuk transaksi ini.</p>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-muted">
            <span>Nama kontak</span>
            <GlassInput value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Contoh: PKU Wonosari" className="h-10 bg-white/70 dark:bg-white/8" autoFocus />
          </label>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Tipe kontak</span>
            <div className="grid grid-cols-3 gap-1.5">
              {CONTACT_TYPE_QUICK_ADD.map((opt) => <button key={opt.value} type="button" aria-pressed={newContactType === opt.value} onClick={() => setNewContactType(opt.value)} className={`h-9 rounded-md border text-xs font-semibold transition ${newContactType === opt.value ? "border-foreground bg-foreground text-background" : "border-border bg-white/50 text-muted hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10"}`}>{opt.label}</button>)}
            </div>
            <p className="text-[11px] leading-4 text-muted">{CONTACT_TYPE_HELP[newContactType]}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button type="button" disabled={savingContact || !newContactName.trim()} onClick={() => void saveNewContact()} className="h-10 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50">{savingContact ? "Menyimpan…" : "Simpan & pilih kontak"}</button>
            <button type="button" onClick={() => { setAddingContact(false); setNewContactName(""); }} className="h-10 rounded-md border border-border px-3 text-xs font-medium">Batal</button>
          </div>
        </div> : <button type="button" onClick={() => { setAddingContact(true); setNewContactName(""); setNewContactType("CUSTOMER"); }} className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm font-medium text-accent transition hover:bg-accent/10"><UserPlus className="h-4 w-4" />Tambah kontak baru</button>;
        const contactField = <RhfDataSelect<CashForm> name="contactId" label="Kontak (opsional)" options={contactOptions} placeholder="Pilih kontak (opsional)" dropdownFooter={contactFooter} dropdownFooterOnly={addingContact} />;
        return <div className="grid gap-6 pb-1">
          <section className="grid gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><ReceiptText className="h-4 w-4 text-accent" />Rincian transaksi</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <RhfDataSelect<CashForm> name="type" label="Tipe" options={[{ value: "CASH_OUT", label: "Pengeluaran" }, { value: "CASH_IN", label: "Pemasukan" }, { value: "TRANSFER", label: "Transfer" }]} />
              <RhfDatePicker<CashForm> name="transactionDate" label="Tanggal" />
            </div>
          </section>

          <section className="grid gap-4 border-t border-border/70 pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Landmark className="h-4 w-4 text-accent" />Akun transaksi</div>
            {needsCoa ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-3 text-sm text-foreground"><p>CoA belum tersedia untuk bisnis ini.</p>{role === "OWNER" || role === "ADMIN" ? <button type="button" onClick={() => void seedChartOfAccounts()} disabled={seedingCoa} className="h-9 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-50">{seedingCoa ? "Menyiapkan..." : "Siapkan CoA SAK EMKM"}</button> : <a href="/accounting/chart-of-accounts" className="text-xs font-semibold text-accent hover:text-accent/75">Buka bagan akun</a>}</div> : <div className="grid gap-4 sm:grid-cols-2">
              <RhfDataSelect<CashForm> name="cashAccountId" label={type === "TRANSFER" ? "Dari kas/bank" : "Kas/bank"} options={cashOptions} placeholder="Cari kas atau bank" />
              {type === "TRANSFER" ? <RhfDataSelect<CashForm> name="destinationAccountId" label="Ke kas/bank" options={cashOptions} placeholder="Cari kas atau bank" /> : <RhfDataSelect<CashForm> name="categoryAccountId" label={type === "CASH_IN" ? "Kategori pendapatan" : "Kategori beban"} options={categoryOptions} placeholder="Cari akun kategori" />}
            </div>}
          </section>

          <section className="grid gap-4 border-t border-border/70 pt-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><UsersRound className="h-4 w-4 text-accent" />Nilai dan catatan</div>
            {type === "TRANSFER" ? <RhfMoneyField<CashForm> name="amount" label="Nominal" prefix placeholder="100.000" className="h-12 bg-accent/5 text-base font-semibold" /> : <div className="grid gap-4 sm:grid-cols-2">{contactField}<RhfMoneyField<CashForm> name="amount" label="Nominal" prefix placeholder="100.000" className="h-12 bg-accent/5 text-base font-semibold" /></div>}
            <RhfTextField<CashForm> name="description" label="Keterangan" placeholder="Contoh: Belanja bahan baku minggu ini" />
          </section>

          <div className="flex justify-end border-t border-border/70 pt-5">
            <button type="submit" disabled={submitting || needsCoa} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background transition hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-48"><Save className="h-4 w-4" />{editing ? "Simpan perubahan" : "Simpan draft"}</button>
          </div>
        </div>;
      }}</ManagedForm>
    </FormDrawer>
  </div>;
}
