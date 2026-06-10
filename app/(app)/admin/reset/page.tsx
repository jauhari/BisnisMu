"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { WorkspaceHeader } from "@/components/layout/workspace";
import { GlassPanel } from "@/components/glass/glass-primitives";
import { GlassSkeleton, GlassErrorState } from "@/components/feedback/glass-feedback";
import { GlassDataSelect, GlassInput } from "@/components/forms/glass-form";
import { apiRequest } from "@/presentation/api/client";

type Category = "transaction" | "special" | "master";

interface GroupMeta {
  key: string;
  label: string;
  description: string;
  category: Category;
  requires: string[];
}
interface BusinessLite {
  id: string;
  name: string;
  type: string;
  status: string;
}
interface ResetMeta {
  groups: GroupMeta[];
  businesses: BusinessLite[];
}
interface ResetResult {
  dryRun?: boolean;
  businessName: string;
  executedGroups: string[];
  autoIncluded: string[];
  deletedByTable: Record<string, number>;
  totalDeleted: number;
}

const CATEGORY_TITLE: Record<Category, string> = {
  transaction: "Data Transaksi",
  special: "Khusus",
  master: "Master Data (berisiko)",
};
const CATEGORY_HINT: Record<Category, string> = {
  transaction: "Data operasional. Aman dihapus tanpa menyentuh master data.",
  special: "Tindakan non-hapus.",
  master: "Menghapus data acuan. Otomatis menarik data transaksi terkait agar konsisten.",
};

/** Toggle checkbox sesuai design system (tanpa <input> native). */
function Check({ checked, onChange, disabled, label }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
        checked ? "border-accent bg-accent text-white" : "border-border bg-white/60 dark:bg-white/10"
      } ${disabled ? "opacity-40" : "hover:border-accent/70"}`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function Page() {
  const meta = useQuery({
    queryKey: ["admin", "reset-meta"],
    queryFn: () => apiRequest<{ data: ResetMeta }>("/api/admin/reset"),
  });

  const [businessId, setBusinessId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmName, setConfirmName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);

  const data = (meta.data as any)?.data as ResetMeta | undefined;
  const groups = data?.groups ?? [];
  const businesses = data?.businesses ?? [];
  const groupByKey = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups]);
  const business = businesses.find((b) => b.id === businessId);

  // Hitung grup yang akan ikut otomatis (transitive requires) di luar yang dipilih.
  const autoIncluded = useMemo(() => {
    const out = new Set<string>();
    const stack = [...selected];
    while (stack.length) {
      const k = stack.pop()!;
      const g = groupByKey.get(k);
      if (!g) continue;
      for (const req of g.requires) {
        if (!out.has(req)) { out.add(req); stack.push(req); }
      }
    }
    for (const s of selected) out.delete(s);
    return out;
  }, [selected, groupByKey]);

  if (meta.isLoading) return <GlassSkeleton className="h-72" />;
  if (meta.error) return <GlassErrorState title="Akses ditolak" description="Reset data hanya untuk SUPER_ADMIN." />;

  function toggle(key: string, v: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(key); else next.delete(key);
      return next;
    });
    setResult(null);
  }

  const hasMaster = [...selected, ...autoIncluded].some((k) => groupByKey.get(k)?.category === "master");
  const confirmOk = !!business && confirmName.trim() === business.name && acknowledged && selected.size > 0;
  const canPreview = !!business && selected.size > 0;

  async function handlePreview() {
    if (!business || !canPreview) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId, groups: [...selected], dryRun: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.message || "Pratinjau gagal.");
      const payload = (json?.data ?? json) as ResetResult;
      setResult(payload);
      toast.info(`Pratinjau: ${payload.totalDeleted.toLocaleString("id-ID")} baris akan dihapus.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pratinjau gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!business || !confirmOk) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId, groups: [...selected], confirmName: confirmName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.message || "Reset gagal.");
      const payload = (json?.data ?? json) as ResetResult;
      setResult(payload);
      toast.success(`Reset selesai. ${payload.totalDeleted.toLocaleString("id-ID")} baris dihapus.`);
      setConfirmName("");
      setAcknowledged(false);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset gagal.");
    } finally {
      setBusy(false);
    }
  }

  const categories: Category[] = ["transaction", "special", "master"];

  return (
    <div className="grid gap-6">
      <WorkspaceHeader
        eyebrow="God Mode"
        title="Reset Data Bisnis"
        description="Hapus data transaksi/master untuk satu bisnis. Tindakan permanen dan dicatat di audit log platform."
      />

      <GlassPanel className="grid gap-4">
        <div className="grid gap-2 sm:max-w-md">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Pilih Bisnis</span>
          <GlassDataSelect
            value={businessId}
            onChange={(v) => { setBusinessId(v); setResult(null); }}
            placeholder="— Pilih bisnis —"
            options={businesses.map((b) => ({ value: b.id, label: `${b.name} (${b.type})` }))}
          />
        </div>
        <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted">
          Data yang dihapus <strong className="text-foreground/80">tidak dapat dikembalikan</strong>. Untuk kasus input ulang
          lewat Scan, cukup pilih <strong className="text-foreground/80">Jurnal &amp; Buku Besar</strong> dan
          <strong className="text-foreground/80"> Penjualan Harian (Scan)</strong> — master data (akun, kontak) tetap utuh.
        </div>
      </GlassPanel>

      {categories.map((cat) => {
        const list = groups.filter((g) => g.category === cat);
        if (!list.length) return null;
        return (
          <GlassPanel key={cat} className="grid gap-3">
            <div>
              <h2 className="text-sm font-semibold">{CATEGORY_TITLE[cat]}</h2>
              <p className="text-xs text-muted">{CATEGORY_HINT[cat]}</p>
            </div>
            <div className="grid gap-2">
              {list.map((g) => {
                const isChecked = selected.has(g.key);
                const isAuto = autoIncluded.has(g.key);
                return (
                  <div
                    key={g.key}
                    className={`flex items-start gap-3 rounded-md border p-3 ${
                      isChecked ? "border-accent/50 bg-accent/5" : isAuto ? "border-warning/40 bg-warning/5" : "border-border/60"
                    }`}
                  >
                    <div className="pt-0.5">
                      <Check checked={isChecked || isAuto} disabled={busy || isAuto} onChange={(v) => toggle(g.key, v)} label={g.label} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground/90">{g.label}</span>
                        {g.category === "master" && (
                          <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-danger">Master</span>
                        )}
                        {isAuto && (
                          <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">Otomatis ikut</span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-muted">{g.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        );
      })}

      <GlassPanel className="grid gap-4">
        <h2 className="text-sm font-semibold text-danger">Konfirmasi Reset</h2>
        {selected.size === 0 ? (
          <p className="text-xs text-muted">Pilih minimal satu kategori data di atas.</p>
        ) : (
          <>
            <p className="text-xs text-muted">
              Akan mereset <strong className="text-foreground/80">{selected.size + autoIncluded.size}</strong> kategori
              {autoIncluded.size > 0 && <> ({autoIncluded.size} ditambahkan otomatis demi konsistensi)</>} untuk bisnis{" "}
              <strong className="text-foreground/80">{business?.name ?? "—"}</strong>.
            </p>
            {hasMaster && (
              <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-xs text-danger">
                Anda menghapus <strong>master data</strong>. Pastikan ini benar-benar diinginkan.
              </div>
            )}
            <div className="grid gap-2 sm:max-w-md">
              <span className="text-xs text-muted">
                Ketik nama bisnis <strong className="text-foreground/80">{business?.name ?? "(pilih bisnis dulu)"}</strong> untuk konfirmasi:
              </span>
              <GlassInput
                value={confirmName}
                disabled={!business || busy}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Nama bisnis persis"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted">
              <Check checked={acknowledged} disabled={busy} onChange={setAcknowledged} label="Saya paham tindakan ini permanen" />
              Saya paham tindakan ini permanen dan tidak dapat dibatalkan.
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canPreview || busy}
                onClick={handlePreview}
                className="h-10 w-fit rounded-md border border-border px-5 text-sm font-medium hover:bg-muted/20 disabled:opacity-40"
              >
                {busy ? "Menghitung…" : "Pratinjau (hitung tanpa hapus)"}
              </button>
              <button
                type="button"
                disabled={!confirmOk || busy}
                onClick={handleReset}
                className="h-10 w-fit rounded-md bg-danger px-6 text-sm font-medium text-white disabled:opacity-40"
              >
                {busy ? "Mereset…" : "Reset Data Sekarang"}
              </button>
            </div>
          </>
        )}
      </GlassPanel>

      {result && (
        <GlassPanel className="grid gap-3">
          <h2 className={`text-sm font-semibold ${result.dryRun ? "text-accent" : "text-success"}`}>
            {result.dryRun ? "Pratinjau — Belum Ada Yang Dihapus" : "Reset Berhasil"}
          </h2>
          <p className="text-xs text-muted">
            Bisnis <strong className="text-foreground/80">{result.businessName}</strong> —{" "}
            total <strong className="text-foreground/80">{result.totalDeleted.toLocaleString("id-ID")}</strong> baris{" "}
            {result.dryRun ? "akan dihapus jika dieksekusi." : "dihapus."}
          </p>
          {result.dryRun && (
            <p className="text-xs text-accent">
              Ini hanya simulasi — data masih utuh. Centang konfirmasi lalu tekan "Reset Data Sekarang" untuk benar-benar menghapus.
            </p>
          )}
          <div className="grid gap-1 text-xs">
            {Object.entries(result.deletedByTable)
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([table, n]) => (
                <div key={table} className="flex justify-between border-b border-border/40 py-1">
                  <span className="font-mono text-muted">{table}</span>
                  <span className="tabular-nums">{n.toLocaleString("id-ID")}</span>
                </div>
              ))}
            {result.totalDeleted === 0 && (
              <p className="text-muted">
                {result.dryRun ? "Tidak ada baris yang akan dihapus (data sudah kosong)." : "Tidak ada baris yang perlu dihapus (data sudah kosong)."}
              </p>
            )}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
