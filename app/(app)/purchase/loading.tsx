import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function PurchaseLoading() {
  return (
    <div className="p-6 space-y-4">
      <GlassSkeleton className="h-8 w-1/3" />
      <GlassSkeleton className="h-96" />
    </div>
  );
}
