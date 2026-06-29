"use client";

import { useEffect, useRef, useState } from "react";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassDataSelect, GlassDatePicker, GlassInput } from "@/components/forms/glass-form";
import { MoneyField } from "@/components/forms/financial-inputs";
import { useListQuery } from "@/presentation/query/dashboard-hooks";
import { apiRequest } from "@/presentation/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Upload, X, Plus, Trash2, CheckCircle, AlertCircle, Loader2, ScanLine } from "lucide-react";
import { ContactPicker } from "@/components/shared/contact-picker";
import { toast } from "sonner";
import { formatRupiah } from "@/presentation/format/number";
import { compressImageForOcr, formatBytes } from "@/presentation/media/compress-image";

type ScanPhase = "idle" | "compressing" | "uploading" | "analyzing" | "parsing";
type SubmitPhase = "idle" | "saving" | "done";

const SCAN_LABELS: Record<Exclude<ScanPhase, "idle">, string> = {
  compressing: "Mengompres foto…",
  uploading: "Mengunggah…",
  analyzing: "AI membaca tulisan tangan…",
  parsing: "Menyusun data…",
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface OcrItem  { nama: string; jumlah: number; }
interface OcrResult { hari?: string; tanggal?: string; pemasukan: OcrItem[]; pengeluaran: OcrItem[]; }
interface ReviewItem { nama: string; jumlah: string; accountId: string; contactId?: string | undefined; contactName?: string | undefined; keterangan?: string | undefined; }

function flattenAccounts(nodes: any[]): any[] {
  return nodes.flatMap((n) => [n, ...flattenAccounts(n.children ?? [])]);
}

// Mapping nama item (dari OCR) → kode akun pendapatan
const INCOME_KEYWORD_MAP: Record<string, string> = {
  "tiket kolam":   "410001",
  "tiket renang":  "410001",
  "tiket":         "410001",
  "tiket paket":   "410004",
  "paket":         "410004",
  "parkir":        "410003",
  "pelampung":     "410002",
  "ban":           "410002",
  "pedagang":      "410009",
  "sewa pedagang": "410009",
  "sewa tempat":   "410007",
  "listrik":       "410008",
};

// Mapping nama item → kode akun beban
const EXPENSE_KEYWORD_MAP: Record<string, string> = {
  "gaji":        "610001",
  "listrik":     "610003",
  "atk":         "610005",
  "sarpras":     "610006",
  "perlengkapan":"610007",
  "sewa alat":   "610020",
  "pemeliharaan":"610022",
  "konsumsi":    "610023",
  "bpjs tk":     "610029",
  "bpjs kes":    "610030",
  "lembur":      "610032",
  "tenaga liburan":"610033",
  "konsumsi liburan":"610035",
  "reparasi":    "610038",
  "pembangunan": "610038",
  "sampah":      "610041",
  "pajak":       "610042",
  "obat air":    "610043",
  "dana sosial": "610045",
  "lainnya":     "610046",
  "nota":        "610046",
};

function matchAccount(name: string, map: Record<string, string>): string {
  const lower = name.toLowerCase();
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code;
  }
  return "";
}

// ─── Halaman ──────────────────────────────────────────────────────────────────
export default function Page() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const accounts = useListQuery<any[]>("/api/accounting/chart-of-accounts", ["list", "accounting-coa"]);
  const settings = useQuery({ queryKey: ["settings", "business"], queryFn: () => apiRequest<{ data: any }>("/api/settings") });
  const bizSettings   = (settings.data as any)?.data?.settings ?? {};
  const defaultCustId: string = bizSettings?.defaultCustomerContactId ?? "";
  const flat = flattenAccounts(accounts.data?.data ?? []);
  const cashOptions    = flat.filter((a) => a.groupCode === 1 && a.isPostingAllowed && String(a.code).startsWith("11"));
  const revenueOptions = flat.filter((a) => a.groupCode === 4 && a.isPostingAllowed);
  const expenseOptions = flat.filter((a) => a.groupCode === 6 && a.isPostingAllowed);

  const byCode = (code: string) => flat.find((a) => a.code === code)?.id ?? "";
  // Cek apakah accountId adalah akun tiket/paket (perlu kolom pelanggan & keterangan)
  const isTicketAccount = (accountId: string) => {
    const acc = flat.find((a) => a.id === accountId);
    return acc && (String(acc.code) === "410001" || String(acc.code) === "410004");
  };

  // State
  const [imageUrl,    setImageUrl]    = useState<string | null>(null);
  const [imageFile,   setImageFile]   = useState<File | null>(null);
  const [scanning,       setScanning]       = useState(false);
  const [scanPhase,      setScanPhase]      = useState<ScanPhase>("idle");
  const [scanProgress,   setScanProgress]   = useState(0);
  const [compressInfo,   setCompressInfo]   = useState<string | null>(null);
  const [ocrDone,        setOcrDone]        = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [submitPhase,    setSubmitPhase]    = useState<SubmitPhase>("idle");
  const [submitProgress, setSubmitProgress] = useState(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tanggal,      setTanggal]      = useState(() => new Date().toLocaleDateString("en-CA"));
  const [cashAccountId,setCashAccountId] = useState(() => {
    const kas = flat.find((a) => a.code === "110101");
    return kas?.id ?? "";
  });
  const [incomeItems,  setIncomeItems]  = useState<ReviewItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<ReviewItem[]>([]);

  // ── Pilih / ambil foto ─────────────────────────────────────────────────────
  useEffect(() => {
    void fetch("/api/health", { credentials: "include", keepalive: true }).catch(() => {});
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  function clearProgressTimer() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }

  function startAnalyzingProgress() {
    clearProgressTimer();
    progressTimerRef.current = setInterval(() => {
      setScanProgress((p) => (p < 88 ? p + 2 : p));
    }, 700);
  }

  function handleFile(file: File) {
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setOcrDone(false);
    setCompressInfo(null);
    setScanPhase("idle");
    setScanProgress(0);
    setIncomeItems([]);
    setExpenseItems([]);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }

  // ── Scan OCR ───────────────────────────────────────────────────────────────
  async function scan() {
    if (!imageFile) return;
    setScanning(true);
    setScanPhase("compressing");
    setScanProgress(8);
    try {
      const compressed = await compressImageForOcr(imageFile);
      setCompressInfo(
        compressed.originalBytes !== compressed.compressedBytes
          ? `${formatBytes(compressed.originalBytes)} → ${formatBytes(compressed.compressedBytes)} · ${compressed.width}×${compressed.height}px`
          : `${formatBytes(compressed.compressedBytes)} · ${compressed.width}×${compressed.height}px`
      );

      setScanPhase("uploading");
      setScanProgress(22);
      const fd = new FormData();
      fd.append("image", compressed.file);

      setScanPhase("analyzing");
      setScanProgress(30);
      startAnalyzingProgress();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55_000);
      let res: Response;
      try {
        res = await fetch("/api/reports/scan", { method: "POST", body: fd, credentials: "include", signal: controller.signal });
      } finally { clearTimeout(timer); }

      clearProgressTimer();
      setScanPhase("parsing");
      setScanProgress(92);

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? json?.message ?? "Gagal scan.");
      const data: OcrResult = json.data;

      // Set tanggal dari OCR jika ada
      if (data.tanggal) {
        const parts = data.tanggal.split(/[-\/]/);
        if (parts.length === 3) {
          const d = parts[0] ?? "01";
          const m = parts[1] ?? "01";
          const y = parts[2] ?? "2026";
          const iso = `${y.length === 4 ? y : "20" + y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
          if (!isNaN(new Date(iso).getTime())) setTanggal(iso);
        }
      }

      // Cari nama default customer dari cache kontak
      const cachedContacts: any[] = (qc.getQueryData(["contacts-search", ""]) as any)?.data ?? [];
      const defaultCustName = cachedContacts.find((c: any) => c.id === defaultCustId)?.name ?? "Pelanggan Umum";

      // Map income items ke akun — tiket/paket auto-isi default contact
      const ticketCodes = ["410001", "410004"];
      setIncomeItems(data.pemasukan.map((item) => {
        const matchedCode = matchAccount(item.nama, INCOME_KEYWORD_MAP);
        const accountId   = byCode(matchedCode);
        const isTicket    = ticketCodes.includes(matchedCode);
        return {
          nama:        item.nama,
          jumlah:      String(item.jumlah),
          accountId,
          contactId:   isTicket && defaultCustId ? defaultCustId : undefined,
          contactName: isTicket && defaultCustId ? defaultCustName : undefined,
        };
      }));

      // Map expense items ke akun
      setExpenseItems(data.pengeluaran.map((item) => ({
        nama:      item.nama,
        jumlah:    String(item.jumlah),
        accountId: byCode(matchAccount(item.nama, EXPENSE_KEYWORD_MAP)),
      })));

      setScanProgress(100);
      setOcrDone(true);
      toast.success(`Berhasil membaca ${data.pemasukan.length} item pemasukan dan ${data.pengeluaran.length} pengeluaran.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal scan gambar.");
    } finally {
      clearProgressTimer();
      setScanning(false);
      setScanPhase("idle");
    }
  }

  // ── Item helpers ───────────────────────────────────────────────────────────
  const addIncome  = () => setIncomeItems(p  => [...p,  { nama: "", jumlah: "", accountId: "" }]);
  const addExpense = () => setExpenseItems(p => [...p, { nama: "", jumlah: "", accountId: "" }]);

  const updateIncome  = (i: number, patch: Partial<ReviewItem>) => setIncomeItems(p  => p.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const updateExpense = (i: number, patch: Partial<ReviewItem>) => setExpenseItems(p => p.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const removeIncome  = (i: number) => setIncomeItems(p  => p.filter((_, idx) => idx !== i));
  const removeExpense = (i: number) => setExpenseItems(p => p.filter((_, idx) => idx !== i));

  const totalIncome  = incomeItems.reduce((s, it)  => s + (parseInt(it.jumlah)  || 0), 0);
  const totalExpense = expenseItems.reduce((s, it) => s + (parseInt(it.jumlah) || 0), 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submit() {
    if (!cashAccountId) { toast.error("Pilih akun kas."); return; }

    const validIncome  = incomeItems.filter(it  => it.accountId && parseInt(it.jumlah) > 0);
    const validExpense = expenseItems.filter(it => it.accountId && parseInt(it.jumlah) > 0);

    if (!validIncome.length && !validExpense.length) {
      toast.error("Tidak ada item valid untuk disimpan."); return;
    }

    setSubmitting(true);
    setSubmitPhase("saving");
    setSubmitProgress(15);
    const submitTimer = setInterval(() => {
      setSubmitProgress((p) => (p < 88 ? p + 4 : p));
    }, 350);
    try {
      await apiRequest("/api/sales/daily/report", {
        method: "POST",
        body: JSON.stringify({
          saleDate: tanggal,
          cashAccountId,
          description: `Laporan Harian ${tanggal}`,
          incomeItems: validIncome.map((it) => ({
            revenueAccountId: it.accountId,
            description: it.keterangan ? `${it.nama} — ${it.keterangan}` : it.nama,
            amount: parseInt(it.jumlah),
            contacts: it.contactId ? [{ contactId: it.contactId, amount: parseInt(it.jumlah) }] : [],
          })),
          expenseItems: validExpense.map((it) => ({
            categoryAccountId: it.accountId,
            description: it.nama || "Pengeluaran harian",
            amount: parseInt(it.jumlah),
          })),
        }),
      });

      setSubmitProgress(100);
      setSubmitPhase("done");
      toast.success("Laporan berhasil disimpan! Jurnal dibuat otomatis.");
      void qc.invalidateQueries({ queryKey: ["list"] });

      // Reset form
      setImageUrl(null); setImageFile(null); setOcrDone(false);
      setIncomeItems([]); setExpenseItems([]);
      setTanggal(new Date().toLocaleDateString("en-CA"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      clearInterval(submitTimer);
      setSubmitting(false);
      setSubmitPhase("idle");
      setSubmitProgress(0);
    }
  }

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="Laporan Harian"
        title="Scan Laporan Harian"
        description="Foto form laporan harian → OCR otomatis → review → simpan ke jurnal."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        {/* Kiri: Upload foto */}
        <GlassPanel className="relative z-10">
          <h2 className="mb-3 text-sm font-semibold">1. Foto / Upload Laporan</h2>

          {imageUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Laporan" className="w-full rounded-lg border border-border object-contain max-h-[70vh]" />
              <button
                type="button"
                onClick={() => { setImageUrl(null); setImageFile(null); setOcrDone(false); setIncomeItems([]); setExpenseItems([]); }}
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-danger text-white shadow"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border text-muted transition hover:border-accent/60 hover:text-accent"
            >
              <Upload className="h-10 w-10" />
              <div className="text-center">
                <p className="font-medium">Drag & drop atau klik untuk upload</p>
                <p className="mt-1 text-xs">JPG, PNG, HEIC · Foto dari kamera juga bisa</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-white/60"
              >
                <Camera className="h-4 w-4" /> Buka Kamera
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFileChange}
          />

          {compressInfo && (
            <p className="mt-2 text-center text-[11px] text-muted">Ukuran upload: {compressInfo}</p>
          )}

          {scanning && scanPhase !== "idle" && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted">
                <span>{SCAN_LABELS[scanPhase]}</span>
                <span className="tabular-nums">{scanProgress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}

          {imageFile && (
            <button
              type="button"
              onClick={() => void scan()}
              disabled={scanning}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {scanning
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {scanPhase !== "idle" ? SCAN_LABELS[scanPhase] : "Memproses…"}</>
                : <><ScanLine className="h-4 w-4" /> Scan & Ekstrak Data</>}
            </button>
          )}

          {ocrDone && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Data berhasil diekstrak. Review di sebelah kanan lalu klik Simpan.
            </div>
          )}
        </GlassPanel>

        {/* Kanan: Review & edit */}
        <div className="grid content-start gap-4">
          {/* Header pengaturan */}
          <GlassPanel className="relative z-10">
            <h2 className="mb-3 text-sm font-semibold">2. Informasi Umum</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs text-muted">Tanggal</span>
                <GlassDatePicker value={tanggal} onChange={setTanggal} className="h-9" />
              </label>
              <label className="grid gap-1">
                <span className="text-xs text-muted">Uang masuk ke (Kas)</span>
                <GlassDataSelect
                  value={cashAccountId}
                  onChange={setCashAccountId}
                  placeholder="Pilih akun kas…"
                  options={cashOptions.map((a) => ({ value: a.id, label: a.name }))}
                  className="h-9"
                />
              </label>
            </div>
          </GlassPanel>

          {/* PEMASUKAN */}
          <GlassPanel className="relative z-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">I. PEMASUKAN</h2>
              {totalIncome > 0 && (
                <span className="text-sm font-medium text-success tabular-nums">{formatRupiah(totalIncome)}</span>
              )}
            </div>

            {incomeItems.length === 0 && !ocrDone && (
              <p className="text-center text-xs text-muted py-4">Scan laporan atau tambah manual.</p>
            )}

            <div className="grid gap-3">
              {incomeItems.map((item, i) => {
                const isTicket = isTicketAccount(item.accountId);
                return (
                  <div key={i} className="grid gap-1.5">
                    {/* Baris utama */}
                    <div className="grid items-end gap-2 sm:grid-cols-[1fr_1.2fr_1fr_auto]">
                      <label className="grid gap-1">
                        {i === 0 && <span className="text-[10px] text-muted uppercase tracking-wide">Keterangan</span>}
                        <GlassInput value={item.nama} onChange={(e) => updateIncome(i, { nama: e.target.value })} placeholder="Nama item" className="h-8 text-sm" />
                      </label>
                      <label className="grid gap-1">
                        {i === 0 && <span className="text-[10px] text-muted uppercase tracking-wide">Akun Pendapatan</span>}
                        <GlassDataSelect
                          value={item.accountId}
                          onChange={(v) => updateIncome(i, { accountId: v })}
                          placeholder={item.accountId ? "" : "Pilih akun…"}
                          options={revenueOptions.map((a) => ({ value: a.id, label: a.name }))}
                          className={`h-8 text-sm ${!item.accountId ? "border-warning/60" : ""}`}
                        />
                      </label>
                      <label className="grid gap-1">
                        {i === 0 && <span className="text-[10px] text-muted uppercase tracking-wide">Nominal (Rp)</span>}
                        <MoneyField
                          value={item.jumlah}
                          onChange={(v) => updateIncome(i, { jumlah: v })}
                          className="h-8 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8"
                          placeholder="0"
                        />
                      </label>
                      <button type="button" onClick={() => removeIncome(i)} className="mb-0.5 h-8 rounded-md border border-border px-2 text-muted hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Baris tambahan untuk Tiket/Paket */}
                    {isTicket && (
                      <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr] pl-2 border-l-2 border-accent/30">
                        <label className="grid gap-1">
                          <span className="text-[10px] text-accent uppercase tracking-wide">Pelanggan</span>
                          <ContactPicker
                            value={item.contactId}
                            valueName={item.contactName}
                            onChange={(id, name) => updateIncome(i, { contactId: id, contactName: name })}
                            onClear={() => updateIncome(i, { contactId: "", contactName: "" })}
                            placeholder="Cari / tambah pelanggan…"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] text-accent uppercase tracking-wide">Keterangan Tiket</span>
                          <GlassInput
                            value={item.keterangan ?? ""}
                            onChange={(e) => updateIncome(i, { keterangan: e.target.value })}
                            placeholder="Mis: 25 dewasa + 5 anak"
                            className="h-8 text-sm"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={addIncome} className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> Tambah baris pemasukan
            </button>

            {incomeItems.some(it => !it.accountId && parseInt(it.jumlah) > 0) && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Ada item tanpa akun — pilih akun sebelum simpan.
              </div>
            )}
          </GlassPanel>

          {/* PENGELUARAN */}
          <GlassPanel className="relative z-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">II. PENGELUARAN</h2>
              {totalExpense > 0 && (
                <span className="text-sm font-medium text-danger tabular-nums">{formatRupiah(totalExpense)}</span>
              )}
            </div>

            {expenseItems.length === 0 && !ocrDone && (
              <p className="text-center text-xs text-muted py-4">Scan laporan atau tambah manual.</p>
            )}

            <div className="grid gap-2">
              {expenseItems.map((item, i) => (
                <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1.2fr_1fr_auto]">
                  <label className="grid gap-1">
                    {i === 0 && <span className="text-[10px] text-muted uppercase tracking-wide">Keterangan</span>}
                    <GlassInput value={item.nama} onChange={(e) => updateExpense(i, { nama: e.target.value })} placeholder="Nama pengeluaran" className="h-8 text-sm" />
                  </label>
                  <label className="grid gap-1">
                    {i === 0 && <span className="text-[10px] text-muted uppercase tracking-wide">Akun Beban</span>}
                    <GlassDataSelect
                      value={item.accountId}
                      onChange={(v) => updateExpense(i, { accountId: v })}
                      placeholder={item.accountId ? "" : "Pilih akun…"}
                      options={expenseOptions.map((a) => ({ value: a.id, label: a.name }))}
                      className={`h-8 text-sm ${!item.accountId ? "border-warning/60" : ""}`}
                    />
                  </label>
                  <label className="grid gap-1">
                    {i === 0 && <span className="text-[10px] text-muted uppercase tracking-wide">Nominal (Rp)</span>}
                    <MoneyField
                      value={item.jumlah}
                      onChange={(v) => updateExpense(i, { jumlah: v })}
                      className="h-8 rounded-md border border-border bg-white/60 px-2 text-sm tabular-nums dark:bg-white/8"
                      placeholder="0"
                    />
                  </label>
                  <button type="button" onClick={() => removeExpense(i)} className="mb-0.5 h-8 rounded-md border border-border px-2 text-muted hover:text-danger">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" onClick={addExpense} className="mt-3 flex items-center gap-1 text-xs text-muted hover:text-foreground">
              <Plus className="h-3.5 w-3.5" /> Tambah baris pengeluaran
            </button>
          </GlassPanel>

          {/* Saldo & Submit */}
          {(incomeItems.length > 0 || expenseItems.length > 0) && (
            <GlassPanel className="relative z-10">
              <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted">Pemasukan</p>
                  <p className="font-semibold text-success tabular-nums">{formatRupiah(totalIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Pengeluaran</p>
                  <p className="font-semibold text-danger tabular-nums">{formatRupiah(totalExpense)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Saldo</p>
                  <p className={`font-bold tabular-nums ${totalIncome - totalExpense >= 0 ? "text-success" : "text-danger"}`}>
                    {formatRupiah(totalIncome - totalExpense)}
                  </p>
                </div>
              </div>
              {submitting && (
                <div className="mb-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted">
                    <span>{submitPhase === "saving" ? "Menyimpan laporan & jurnal…" : "Selesai"}</span>
                    <span className="tabular-nums">{submitProgress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-full rounded-full bg-foreground transition-all duration-300"
                      style={{ width: `${submitProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50"
              >
                {submitting ? "Menyimpan…" : "✓ Simpan & Buat Jurnal Otomatis"}
              </button>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  );
}
