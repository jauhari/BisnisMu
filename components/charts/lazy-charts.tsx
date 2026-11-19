"use client";

import dynamic from "next/dynamic";
import { GlassCard } from "@/components/glass/glass-primitives";
import { GlassSkeleton } from "@/components/feedback/glass-feedback";

// Recharts hanya diunduh saat chart benar-benar dirender di browser.
// Wrapper ini satu-satunya pintu masuk ke financial-charts, supaya recharts
// tidak lagi ikut bundle awal halaman analitik.
const ChartSkeleton = () => (
  <GlassCard className="min-h-80">
    <GlassSkeleton className="h-5 w-32" />
    <GlassSkeleton className="mt-4 h-72" />
  </GlassCard>
);

export const LazyRevenueTrendChart = dynamic(
  () => import("./financial-charts").then((module) => ({ default: module.RevenueTrendChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

export const LazyActivityBarChart = dynamic(
  () => import("./financial-charts").then((module) => ({ default: module.ActivityBarChart })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
