"use client";

import { useMemo, useState } from "react";
import { GlassErrorState, GlassSkeleton } from "@/components/feedback/glass-feedback";
import { JournalBalanceBar } from "@/components/accounting/accounting-components";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassTable } from "@/components/tables/glass-table";
import { useListQuery, usePostMutation } from "@/presentation/query/dashboard-hooks";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";
import { FormDrawer } from "@/components/layout/form-drawer";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { formatDate, formatRupiah } from "@/presentation/format/number";

interface Line { accountId: string; side: "DEBIT" | "CREDIT"; amount: string }
interface EditingDraft { id: string; journalNumber: string }
function flattenAccounts(nodes: any[]): any[] { return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]); }
function digitsOnly(value: string) { return value.replace(/\D/g, ""); }
function formatAmount(value: string) { const raw = digitsOnly(value); return raw ? Number(raw).toLocaleString("id-ID") : ""; }
function amountTone(side: Line["side"]) { return side === "DEBIT" ? "border-success/35 bg-success/5 text-success focus-visible:ring-success/25" : "border-danger/35 bg-danger/5 text-danger focus-visible:ring-danger/25"; }
const ACCOUNT_GROUP_LABELS: Record<number, string> = { 1: "Aset", 2: "Liabilitas", 3: "Ekuitas", 4: "Pendapatan", 5: "HPP", 6: "Beban", 7: "Beban lain" };

const JOURNAL_STATUS_LABELS: Record<string, string> = { DRAFT: "Draf", POSTED: "Diposting", REVERSED: "Dibalik" };

function accountNames(lines: any[] | undefined, side: "DEBIT" | "CREDIT"): string {
  const names = (lines ?? []).filter((l) => l.side === side).map((l) => (l.account ? l.account.name : l.accountId));
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
}

export default function Page() {
  const postMutation = usePostMutation("/api/accounting/journals");
  const journals = useListQuery<any[]>("/api/accounting/journals/list", ["list", "accounting-journals-list"]);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);

  const postable = useMemo(() => flattenAccounts(accounts.data?.data ?? []).filter((a) => a.isPostingAllowed), [accounts.data]);
  const [transactionDate, setTransactionDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; });
  const [description, setDescription] = useState("Penyesuaian manual");
  const [lines, setLines] = useState<Line[]>([{ accountId: "", side: "DEBIT", amount: "" }, { accountId: "", side: "CREDIT", amount: "" }]);
  const [editingDraft, setEditingDraft] = useState<EditingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ msg: string; onOk: () => void } | null>(null);

  if (accounts.isLoading || journals.isLoading) return <GlassSkeleton className="h-72" />;
  if (accounts.error || journals.error) return <GlassErrorState title="Jurnal belum bisa dimuat." description="Coba muat ulang halaman ini beberapa saat lagi." />;

  const debit = lines.filter((l) => l.side === "DEBIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const credit = lines.filter((l) => l.side === "CREDIT").reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const update = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { accountId: "", side: "DEBIT", amount: "" }]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const resetForm = () => { setEditingDraft(null); setDescription("Penyesuaian manual"); setLines([{ accountId: "", side: "DEBIT", amount: "" }, { accountId: "", side: "CREDIT", amount: "" }]); setFormOpen(false); };

  function payload() {
    const valid = lines.filter((l) => l.accountId && Number(l.amount) > 0);
    if (valid.length < 2) throw new Error("Minimal 2 baris dengan akun dan jumlah > 0.");
    if (debit !== credit) throw new Error("Total debit harus sama dengan total kredit.");
    return { transactionDate, source: "MANUAL_JOURNAL", description, lines: valid.map((l) => ({ accountId: l.accountId, side: l.side, amount: l.amount })) };
  }

  async function submitPosted() {
    setError(null); setOkMsg(null); setBusy(true);
    try {
      if (editingDraft) await requestJson(`/api/accounting/journals/drafts/${editingDraft.id}`, "PUT", payload());
      if (editingDraft) await requestJson(`/api/accounting/journals/${editingDraft.id}/post`, "POST");
      else await postMutation.mutateAsync(payload());
      setOkMsg("Jurnal diposting dan terkunci."); resetForm(); await journals.refetch?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memposting jurnal."); }
    finally { setBusy(false); }
  }

  async function saveDraft() {
    setError(null); setOkMsg(null); setBusy(true);
    try {
      const res = editingDraft ? await requestJson(`/api/accounting/journals/drafts/${editingDraft.id}`, "PUT", payload()) : await requestJson("/api/accounting/journals/drafts", "POST", payload());
      setEditingDraft({ id: res.data.id, journalNumber: res.data.journalNumber });
      setOkMsg("Draft tersimpan. Masih bisa diedit sebelum post."); setFormOpen(false); await journals.refetch?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan draft."); }
    finally { setBusy(false); }
  }

  // Posting, hapus, dan jurnal balik tidak bisa dibatalkan, jadi minta konfirmasi dulu.
  function confirmRowAction(action: "post" | "delete" | "reverse", row: any) {
    const msg = action === "post"
      ? `Posting jurnal ${row.nomor}? Setelah diposting, jurnal terkunci dan tidak bisa diubah atau dihapus.`
      : action === "delete"
        ? `Hapus draft jurnal ${row.nomor}? Draft yang dihapus tidak bisa dikembalikan.`
        : `Buat jurnal balik untuk ${row.nomor}? Sistem akan membuat jurnal pembalik dengan nominal yang sama di sisi berlawanan, sehingga efek jurnal ini dibatalkan.`;
    setConfirmDialog({ msg, onOk: () => void rowAction(action, row) });
  }

  async function rowAction(action: string, row: any) {
    setError(null); setOkMsg(null); setBusy(true);
    try {
      if (action === "edit") loadJournalToForm(row.raw, true);
      if (action === "copy") loadJournalToForm(row.raw, false);
      if (action === "delete") { await requestJson(`/api/accounting/journals/drafts/${row.id}`, "DELETE"); setOkMsg("Draft dihapus."); }
      if (action === "post") { await requestJson(`/api/accounting/journals/${row.id}/post`, "POST"); setOkMsg("Draft diposting dan terkunci."); }
      if (action === "reverse") { await requestJson(`/api/accounting/journals/${row.id}/reverse`, "POST"); setOkMsg("Jurnal pembalik dibuat."); }
      await journals.refetch?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Aksi gagal."); }
    finally { setBusy(false); }
  }

  function loadJournalToForm(entry: any, editDraft: boolean) {
    setTransactionDate(String(entry.transactionDate).slice(0, 10));
    setDescription(entry.description ?? "Penyesuaian manual");
    setLines((entry.lines ?? []).map((line: any) => ({ accountId: line.accountId, side: line.side, amount: String(line.amount ?? "") })));
    setEditingDraft(editDraft ? { id: entry.id, journalNumber: entry.journalNumber } : null);
    setOkMsg(editDraft ? `Mengedit draft ${entry.journalNumber}.` : "Disalin sebagai jurnal baru.");
    setFormOpen(true);
  }

  const rows = (journals.data?.data ?? []).map((entry: any) => ({
    id: entry.id,
    raw: entry,
    tanggal: formatDate(new Date(entry.transactionDate)),
    nomor: entry.journalNumber,
    status: entry.status,
    // Debit & kredit jurnal selalu sama; tampilkan satu nominal dan pisahkan
    // akun per sisi supaya pengguna awam bisa membaca alurnya.
    akun: `${accountNames(entry.lines, "DEBIT")} ${accountNames(entry.lines, "CREDIT")}`, // untuk pencarian
    debitAccounts: accountNames(entry.lines, "DEBIT"),
    creditAccounts: accountNames(entry.lines, "CREDIT"),
    nominal: formatRupiah(entry.totalDebit),
    memo: entry.description ?? "",
  }));

  return <div className="grid gap-6"><WorkspaceHeader eyebrow="Akuntansi" title="Jurnal" description="Jurnal manual untuk koreksi, penyesuaian akhir periode, reversal, dan transaksi khusus." action={<button type="button" onClick={() => { resetForm(); setFormOpen(true); }} className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Tambah jurnal manual</button>} />{okMsg ? <p role="status" className="rounded-md border border-success/25 bg-success/8 px-3 py-2 text-sm text-success">{okMsg}</p> : null}<GlassTable selectable={false} tableId="accounting-journals-v2" columns={[{ key: "tanggal", header: "Tanggal" }, { key: "nomor", header: "No. Jurnal" }, { key: "memo", header: "Keterangan" }, { key: "akun", header: "Akun", render: (row: any) => <div className="grid gap-1 text-sm"><div><span className="mr-1 text-xs font-medium text-muted">Debit:</span>{row.debitAccounts}</div><div><span className="mr-1 text-xs font-medium text-muted">Kredit:</span>{row.creditAccounts}</div></div> }, { key: "nominal", header: "Nominal", render: (row: any) => <span className="whitespace-nowrap font-medium">{row.nominal}</span> }, { key: "status", header: "Status", render: (row: any) => <span className={row.status === "DRAFT" ? "rounded bg-warning/15 px-2 py-1 text-xs font-medium text-warning" : row.status === "REVERSED" ? "rounded bg-danger/10 px-2 py-1 text-xs font-medium text-danger" : "rounded bg-success/12 px-2 py-1 text-xs font-medium text-success"}>{JOURNAL_STATUS_LABELS[row.status] ?? row.status}</span> }, { key: "actions", header: "Aksi", render: (row: any) => <div className="flex flex-wrap gap-1.5">{row.status === "DRAFT" ? <><button type="button" onClick={() => void rowAction("edit", row)} className="rounded border border-border px-2 py-1 text-xs">Ubah</button><button type="button" onClick={() => confirmRowAction("post", row)} className="rounded bg-foreground px-2 py-1 text-xs text-background">Posting</button><button type="button" onClick={() => confirmRowAction("delete", row)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger">Hapus</button></> : <><button type="button" onClick={() => void rowAction("copy", row)} className="rounded border border-border px-2 py-1 text-xs">Salin</button>{row.status === "POSTED" ? <button type="button" onClick={() => confirmRowAction("reverse", row)} className="rounded border border-danger/40 px-2 py-1 text-xs text-danger">Jurnal balik</button> : null}</>}</div> }]} rows={rows} empty="Belum ada jurnal" />{confirmDialog ? <GlassPanel className="grid gap-3"><p className="text-sm">{confirmDialog.msg}</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { confirmDialog.onOk(); setConfirmDialog(null); }} className="h-9 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50">Ya, lanjutkan</button><button type="button" onClick={() => setConfirmDialog(null)} className="h-9 rounded-md border border-border px-4 text-sm">Batal</button></div></GlassPanel> : null}{error && !formOpen ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<FormDrawer open={formOpen} onClose={() => { setFormOpen(false); if (!editingDraft) resetForm(); }} title={editingDraft ? "Edit draft jurnal" : "Tambah jurnal manual"} subtitle="Dipakai untuk koreksi, penyesuaian, reversal, saldo awal, atau transaksi khusus."><div className="grid gap-4"><div className="grid gap-4 sm:grid-cols-[minmax(180px,220px)_1fr]"><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Tanggal transaksi</span><GlassDatePicker value={transactionDate} onChange={setTransactionDate} className="h-11 w-full" /></label><label className="grid gap-2"><span className="text-xs font-medium uppercase tracking-wide text-muted">Keterangan</span><GlassInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Koreksi / penyesuaian / saldo awal" className="h-11" /></label></div>{editingDraft ? <div className="rounded-md border border-accent/30 bg-accent/8 px-3 py-2 text-sm text-accent">Mengedit draft {editingDraft.journalNumber}. Jurnal posted tidak diedit langsung.</div> : null}<div className="grid gap-3">{lines.map((line, i) => <div key={i} className="grid items-end gap-2 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_120px] lg:grid-cols-[minmax(0,1fr)_120px_minmax(140px,160px)_72px]"><label className="grid gap-1"><span className="text-xs text-muted">Akun</span><GlassDataSelect value={line.accountId} onChange={(v) => update(i, { accountId: v })} placeholder="Pilih akun" options={postable.map((a) => ({ value: a.id, label: `${a.code} ${a.name}`, code: a.code, name: a.name, groupLabel: ACCOUNT_GROUP_LABELS[a.groupCode] ?? `Grup ${a.groupCode}`, normalBalance: a.normalBalance }))} className="h-10" /></label><label className="grid gap-1"><span className="text-xs text-muted">Posisi</span><GlassDataSelect value={line.side} onChange={(v) => update(i, { side: v as Line["side"] })} options={[{ value: "DEBIT", label: "Debit" }, { value: "CREDIT", label: "Kredit" }]} className="h-10" /></label><label className="grid gap-1 sm:col-span-2 lg:col-span-1"><span className="text-xs text-muted">Nominal</span><GlassInput value={formatAmount(line.amount)} onChange={(e) => update(i, { amount: digitsOnly(e.target.value) })} inputMode="numeric" className={`h-10 font-medium ${amountTone(line.side)}`} placeholder="0" /></label><button type="button" onClick={() => removeLine(i)} disabled={lines.length <= 2} className="h-10 rounded-md border border-border px-3 text-sm text-muted transition hover:border-muted hover:text-foreground disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted sm:justify-self-start lg:justify-self-stretch">Hapus</button></div>)}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={addLine} className="h-10 rounded-md border border-border px-4 text-sm">+ Tambah baris</button><button type="button" disabled={busy} onClick={() => void saveDraft()} className="h-10 rounded-md border border-border px-4 text-sm font-medium disabled:opacity-50">Simpan draft</button><button type="button" disabled={busy} onClick={() => void submitPosted()} className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50">Posting jurnal</button>{editingDraft ? <button type="button" disabled={busy} onClick={resetForm} className="h-10 rounded-md px-4 text-sm text-muted disabled:opacity-50">Batal edit</button> : null}</div>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{okMsg ? <p role="status" className="text-sm text-success">{okMsg}</p> : null}<JournalBalanceBar debit={BigInt(debit)} credit={BigInt(credit)} /></div></FormDrawer></div>;
}

async function requestJson(url: string, method: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body) { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(body); }
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.message ?? json?.error?.message ?? "Permintaan gagal, coba lagi.");
  return json;
}