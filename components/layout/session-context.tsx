"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

/** Ringkasnya data sesi yang dipakai header/shell — diambil sekali di server (app/(app)/layout.tsx). */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  platformRole: string;
}

export interface SessionBusiness {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  active: boolean;
}

export interface SessionContextValue {
  user: SessionUser;
  businesses: SessionBusiness[];
  /** Business aktif untuk sesi ini (dari session.activeBusinessId). */
  activeBusinessId: string;
  /** Baris `businesses` yang cocok dengan activeBusinessId (fallback: entri pertama). */
  activeBusiness: SessionBusiness | undefined;
  /**
   * Hasil `canHardMutateOrganizationTransaction` untuk business aktif — field
   * yang sama dengan `hardMutation` di endpoint sesi, dihitung sekali di server.
   */
  hardMutation: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Menyediakan data sesi dari props server ke seluruh tree (app) tanpa fetch.
 * Halaman yang butuh `businessId` cukup memanggil `useSessionContext()`.
 */
export function SessionProvider({
  user,
  businesses,
  activeBusinessId,
  hardMutation,
  children,
}: {
  user: SessionUser;
  businesses: SessionBusiness[];
  activeBusinessId: string;
  hardMutation: boolean;
  children: ReactNode;
}) {
  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      businesses,
      activeBusinessId,
      activeBusiness: businesses.find((business) => business.id === activeBusinessId) ?? businesses[0],
      hardMutation,
    }),
    [user, businesses, activeBusinessId, hardMutation],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSessionContext harus dipakai di dalam <SessionProvider>.");
  return context;
}
