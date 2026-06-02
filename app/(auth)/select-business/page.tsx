import { GlassCard } from "@/components/glass/glass-primitives";

export default function Page() { return <main className="grid min-h-screen place-items-center bg-background p-6"><GlassCard className="w-full max-w-lg"><h1 className="text-2xl font-semibold">Select business</h1><p className="mt-2 text-sm text-muted">Business selection binds to BusinessService once auth and membership exist.</p></GlassCard></main>; }
