"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { GlassForm, GlassInput, GlassField } from "@/components/forms/glass-form";

const DEFAULT_EMAIL = "admin@akuntansimu.local";
const DEFAULT_PASSWORD = "Password123!";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error(await response.text());
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassForm className="mt-6" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <GlassField label="Email">
        <GlassInput inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </GlassField>
      <GlassField label="Password">
        <GlassInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </GlassField>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button type="submit" disabled={loading} className="h-11 rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60">
        {loading ? "Signing in..." : "Continue"}
      </button>
    </GlassForm>
  );
}
