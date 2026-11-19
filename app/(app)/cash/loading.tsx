import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function CashLoading() {
  return (
    <div className="p-6 space-y-4">
      <GlassSkeleton className="h-8 w-48" />
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <GlassSkeleton key={i} className="h-28" />)}
      </div>
      <GlassSkeleton className="h-96" />
    </div>
  );
}
