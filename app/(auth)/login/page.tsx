import { LoginForm } from "@/components/auth/login-form";
import { GlassCard } from "@/components/glass/glass-primitives";

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <GlassCard className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold">BisnisMu</h1>
        <p className="mt-2 text-sm text-muted">Masuk ke akun Anda.</p>
        <LoginForm />
        <p className="mt-4 text-center text-sm text-muted">Belum punya akun? <a href="/register" className="text-accent underline">Daftar di sini</a></p>
      </GlassCard>
    </main>
  );
}
