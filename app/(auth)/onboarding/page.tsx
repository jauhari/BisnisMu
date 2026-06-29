"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-primitives";
import { GlassDataSelect } from "@/components/forms/glass-form";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [0, 1, 2].map((offset) => ({
  value: String(CURRENT_YEAR - offset),
  label: String(CURRENT_YEAR - offset),
}));

type StepStatus = "done" | "active" | "pending";

function Step({
  num,
  title,
  description,
  status,
}: {
  num: number;
  title: string;
  description: string;
  status: StepStatus;
}) {
  return (
    <div
      className={`flex gap-4 rounded-xl border p-4 transition ${
        status === "active" ? "border-accent bg-accent/5" : "border-border/60"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {status === "done" ? (
          <CheckCircle2 className="h-6 w-6 text-success" />
        ) : status === "active" ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
            {num}
          </div>
        ) : (
          <Circle className="h-6 w-6 text-muted/40" />
        )}
      </div>
      <div>
        <p
          className={`font-medium ${
            status === "done"
              ? "text-muted line-through"
              : status === "pending"
              ? "text-muted/60"
              : ""
          }`}
        >
          {title}
        </p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const [bizName, setBizName] = useState("usaha Anda");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/businesses", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        const list = Array.isArray(json) ? json : (json.data ?? []);
        if (list[0]?.name) setBizName(list[0].name);
      })
      .catch(() => {});
  }, []);

  async function openPeriod() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/accounting/fiscal-periods", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiscalYear: Number(year) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          json?.error?.message || json?.message || "Gagal membuka periode."
        );
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Gagal membuka periode fiskal."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <GlassCard className="w-full max-w-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Selamat datang!</h1>
          <p className="mt-2 text-sm text-muted">
            Akun dan{" "}
            <span className="font-medium text-foreground">{bizName}</span>{" "}
            sudah disiapkan. Satu langkah lagi sebelum mulai.
          </p>
        </div>

        <div className="grid gap-3">
          <Step
            num={1}
            title="Buat akun & usaha"
            description="Akun dan profil usaha berhasil dibuat."
            status="done"
          />
          <Step
            num={2}
            title="Bagan Akun SAK EMKM"
            description="80+ akun standar sudah siap digunakan."
            status="done"
          />
          <Step
            num={3}
            title="Buka periode fiskal"
            description="Pilih tahun fiskal untuk mulai mencatat transaksi."
            status="active"
          />
        </div>

        <div className="mt-6 grid gap-3 rounded-xl border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium">Tahun fiskal pertama</p>
          <GlassDataSelect
            value={year}
            onChange={setYear}
            options={YEAR_OPTIONS}
            placeholder="Pilih tahun"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="button"
            onClick={openPeriod}
            disabled={loading}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-foreground text-sm font-medium text-background disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Membuka periode…
              </>
            ) : (
              "Buka & mulai gunakan →"
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Periode fiskal bisa ditambah kapan saja melalui menu Accounting →
          Fiscal Periods.
        </p>
      </GlassCard>
    </main>
  );
}
