import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function InventoryLoading() {
  return (
    <div className="p-6 space-y-4">
      <GlassSkeleton className="h-10 w-1/3" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <GlassSkeleton key={i} className="h-24" />)}
      </div>
      <GlassSkeleton className="h-96" />
    </div>
  );
}
