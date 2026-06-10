import { RegisterForm } from "@/components/auth/register-form";
import { GlassCard } from "@/components/glass/glass-primitives";
import Link from "next/link";

export default function Page() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <GlassCard className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Daftar BisnisMu</h1>
        <p className="mt-2 text-sm text-muted">Buat akun dan usaha baru dalam satu langkah.</p>
        <RegisterForm />
        <p className="mt-4 text-center text-sm text-muted">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-accent underline">Masuk</Link>
        </p>
      </GlassCard>
    </main>
  );
}
