"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: "24px" }}>
          <div style={{ maxWidth: "400px", textAlign: "center" }}>
            <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Terjadi kesalahan</h1>
            <p style={{ color: "#666", marginTop: "8px", fontSize: "14px" }}>
              Tim kami sudah mendapat notifikasi. Coba muat ulang halaman.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: "16px", padding: "8px 24px", background: "#111", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px" }}
            >
              Muat ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
