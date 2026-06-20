"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassForm, GlassInput, GlassField } from "@/components/forms/glass-form";

function readErrorMessage(json: Record<string, unknown>, fallback: string): string {
  if (typeof json.message === "string" && json.message.trim()) return json.message;
  if (typeof json.error === "object" && json.error && typeof (json.error as { message?: string }).message === "string") {
    return (json.error as { message: string }).message;
  }
  if (typeof json.code === "string" && json.code.trim()) return json.code;
  return fallback;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const signInRes = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const signInJson = (await signInRes.json().catch(() => ({}))) as Record<string, unknown>;

      if (!signInRes.ok) {
        throw new Error(readErrorMessage(signInJson, "Email atau password salah."));
      }

      const bootstrapRes = await fetch("/api/auth/bootstrap", {
        method: "POST",
        credentials: "include",
      });
      const bootstrapJson = (await bootstrapRes.json().catch(() => ({}))) as Record<string, unknown>;

      if (!bootstrapRes.ok) {
        const message = readErrorMessage(bootstrapJson, "Gagal menyiapkan sesi.");
        if (message.toLowerCase().includes("business not found") || message.toLowerCase().includes("usaha")) {
          router.push("/select-business");
          router.refresh();
          return;
        }
        throw new Error(message);
      }

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