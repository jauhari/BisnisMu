import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function ArApLoading() {
  return (
    <div className="p-6 space-y-4">
      <GlassSkeleton className="h-8 w-1/3" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => <GlassSkeleton key={i} className="h-64" />)}
      </div>
    </div>
  );
}
