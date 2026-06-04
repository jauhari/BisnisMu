"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassForm, GlassInput, GlassField, GlassDataSelect } from "@/components/forms/glass-form";

const BUSINESS_TYPE_OPTIONS = [
  { value: "UMKM", label: "UMKM / Usaha Kecil Menengah" },
  { value: "PERORANGAN", label: "Usaha Perorangan" },
  { value: "BUMDES", label: "BUMDes / Badan Usaha Desa" },
  { value: "CV", label: "CV / Commanditaire Vennootschap" },
  { value: "UD", label: "UD / Usaha Dagang" },
];

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("UMKM");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password, businessName, businessType }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || json?.message || "Pendaftaran gagal.");
      router.push("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pendaftaran gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassForm className="mt-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <GlassField label="Nama lengkap">
        <GlassInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Budi Santoso" />
      </GlassField>
      <GlassField label="Email">
        <GlassInput type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="budi@toko.com" />
      </GlassField>
      <GlassField label="Password (min. 8 karakter)">
        <GlassInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </GlassField>
      <GlassField label="Nama usaha">
        <GlassInput value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Toko Budi Jaya" />
      </GlassField>
      <GlassField label="Jenis usaha">
        <GlassDataSelect
          value={businessType}
          onChange={setBusinessType}
          options={BUSINESS_TYPE_OPTIONS}
        />
      </GlassField>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={loading || !name || !email || !password || !businessName} className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60">
        {loading ? "Mendaftar…" : "Daftar & masuk"}
      </button>
    </GlassForm>
  );
}
