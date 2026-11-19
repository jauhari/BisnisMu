import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function PosLoading() {
  return (
    <div className="p-4 grid gap-4">
      <div className="flex gap-2">
        <GlassSkeleton className="h-10 w-48" />
        <GlassSkeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassSkeleton className="h-[400px]" />
        <GlassSkeleton className="h-[400px] md:col-span-2" />
      </div>
    </div>
  );
}
