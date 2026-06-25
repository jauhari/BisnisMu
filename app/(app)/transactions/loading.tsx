import { GlassSkeleton } from "@/components/feedback/glass-feedback";

export default function TransactionsLoading() {
  return (
    <div className="p-6 space-y-4">
      <GlassSkeleton className="h-8 w-1/2" />
      <GlassSkeleton className="h-10 w-full" />
      <GlassSkeleton className="h-[500px]" />
    </div>
  );
}
