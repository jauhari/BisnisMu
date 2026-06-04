"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassForm, GlassInput, GlassField } from "@/components/forms/glass-form";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      // Try primary login (argon2 credential auth)
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || json?.code || "Email atau password salah.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassForm className="mt-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <GlassField label="Email">
        <GlassInput type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@usaha.com" autoComplete="email" />
      </GlassField>
      <GlassField label="Password">
        <GlassInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
      </GlassField>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={loading || !email || !password} className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60">
        {loading ? "Masuk…" : "Masuk"}
      </button>
    </GlassForm>
  );
}
