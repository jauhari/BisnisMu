import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function SalesLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <GlassSkeleton className="h-9 w-24" />
        <GlassSkeleton className="h-9 w-24" />
      </div>
      <GlassSkeleton className="h-10 w-full" />
      <GlassSkeleton className="h-[500px]" />
    </div>
  );
}
