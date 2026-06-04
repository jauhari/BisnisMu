"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/presentation/api/client";

interface BusinessInfo { id: string; name: string; role: string; active: boolean; }
interface CurrentUser  { id: string; name: string; email: string; platformRole: string; }

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn:  () => apiRequest<{ data: CurrentUser }>("/api/auth/me"),
    select:   (raw) => (raw as any).data as CurrentUser,
    staleTime: 5 * 60_000,
  });
}

export function useActiveBusiness() {
  return useQuery({
    queryKey: ["auth", "businesses"],
    queryFn: () => apiRequest<{ data: BusinessInfo[] } | BusinessInfo[]>("/api/auth/businesses"),
    select: (raw) => { const list: BusinessInfo[] = Array.isArray(raw) ? raw : ((raw as any).data ?? []); return list.find((b) => b.active) ?? list[0]; },
    staleTime: 5 * 60_000,
  });
}

/** Konversi nilai apapun (Date | string | undefined) ke string YYYY-MM-DD aman. */
export function toDateStr(value: Date | string | undefined | null): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

const now = new Date();
const DEFAULT_STARTS = new Date(now.getFullYear(), now.getMonth(), 1);
const DEFAULT_ENDS = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

export function useReportRange() {
  const [startsOn, setStartsOn] = useState<Date>(DEFAULT_STARTS);
  const [endsOn, setEndsOn] = useState<Date>(DEFAULT_ENDS);
  return { startsOn, endsOn, setStartsOn, setEndsOn };
}

export function buildRequest(businessId: string, startsOn: Date, endsOn: Date) {
  return { command: { businessId, actorUserId: "current", startsOn, endsOn } };
}
