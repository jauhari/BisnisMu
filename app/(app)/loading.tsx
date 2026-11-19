import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function AppLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <GlassSkeleton className="h-8 w-48" />
          <GlassSkeleton className="mt-2 h-4 w-64" />
        </div>
        <GlassSkeleton className="h-9 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassSkeleton key={i} className="h-28" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GlassSkeleton className="h-80" />
        <GlassSkeleton className="h-80" />
      </div>

      <GlassSkeleton className="h-64" />
    </div>
  );
}
