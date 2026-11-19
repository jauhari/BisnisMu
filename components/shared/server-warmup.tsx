"use client";

import { useEffect } from "react";

/**
 * Pings /api/health once per session to reduce cold-start latency
 * on the first meaningful API call (scan, save report, etc.).
 */
export function ServerWarmup() {
  useEffect(() => {
    const key = "bisnismu:warmup";
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;

    void fetch("/api/health", { credentials: "include", keepalive: true })
      .then(() => sessionStorage.setItem(key, "1"))
      .catch(() => {});
  }, []);

  return null;
}