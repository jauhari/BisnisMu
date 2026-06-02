import { LoginForm } from "@/components/auth/login-form";
import { GlassCard } from "@/components/glass/glass-primitives";

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <GlassCard className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">AkuntansiMu</h1>
        <p className="mt-2 text-sm text-muted">Masuk dengan akun owner development.</p>
        <LoginForm />
      </GlassCard>
    </main>
  );
}
