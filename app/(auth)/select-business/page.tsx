"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/glass/glass-primitives";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";

interface Business { id: string; name: string; role: string; active: boolean; }

export default function Page() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/businesses", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setBusinesses(Array.isArray(json) ? json : (json.data ?? [])))
      .catch(() => setError("Tidak dapat memuat daftar usaha."))
      .finally(() => setLoading(false));
  }, []);

  async function select(businessId: string) {
    setSwitching(businessId); setError(null);
    try {
      const res = await fetch("/api/auth/select-business", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (!res.ok) throw new Error("Gagal memilih usaha.");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
      setSwitching(null);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <GlassCard className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold">Pilih Usaha</h1>
        <p className="mt-2 text-sm text-muted">Pilih usaha yang ingin Anda kelola.</p>
        {loading ? <GlassSkeleton className="mt-6 h-32" /> : (
          <div className="mt-6 grid gap-3">
            {businesses.length === 0 ? <p className="text-sm text-muted">Belum tergabung di usaha manapun.</p> : null}
            {businesses.map((b) => (
              <button
                key={b.id}
                type="button"
                disabled={switching !== null}
                onClick={() => select(b.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${b.active ? "border-accent bg-accent/8" : "border-border hover:bg-white/60 dark:hover:bg-white/8"} disabled:opacity-50`}
              >
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted">{b.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  {b.active ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Aktif</span> : null}
                  {switching === b.id ? <span className="text-xs text-muted">Memuat…</span> : null}
                </div>
              </button>
            ))}
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 border-t border-border/60 pt-4">
          <a href="/register" className="text-sm text-accent underline">+ Buat usaha baru</a>
        </div>
      </GlassCard>
    </main>
  );
}
