import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function ReportsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <GlassSkeleton className="h-8 w-40" />
          <GlassSkeleton className="mt-2 h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <GlassSkeleton className="h-9 w-24" />
          <GlassSkeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <GlassSkeleton key={i} className="h-24" />)}
      </div>

      <GlassSkeleton className="h-[420px]" />
      <GlassSkeleton className="h-64" />
    </div>
  );
}
