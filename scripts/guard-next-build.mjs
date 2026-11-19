#!/usr/bin/env node
/**
 * Menolak `next build` saat dev server masih berjalan.
 *
 * `next dev` dan `next build` menulis ke folder `.next` yang sama. Kalau
 * dijalankan bersamaan, build menghapus/mengganti chunk yang sedang dipakai
 * dev server, dan dev server mulai melempar error yang menyesatkan:
 *
 *     Error: Cannot find module './5873.js'
 *     TypeError: Cannot read properties of undefined (reading '/_app')
 *
 * Gejalanya tidak menunjuk ke penyebab sebenarnya, sehingga sulit didiagnosis
 * dan menghabiskan waktu. Script ini menghentikan build lebih awal dengan
 * pesan yang jelas.
 *
 * Aman untuk CI/CD: kalau tidak ada port yang listen, atau alat pemeriksa
 * tidak tersedia (mis. di container Vercel), script ini lolos dan build
 * berjalan seperti biasa.
 *
 * Catatan: build ke folder dist terpisah sengaja TIDAK dipakai, karena
 * Next.js menulis ulang `tsconfig.json` saat distDir berubah dan itu membuat
 * working tree kotor setiap kali build. Lebih sederhana menghentikan dev
 * server sebelum build.
 */
import { execFileSync } from "node:child_process";

/** Port dev server, sinkron dengan script `dev` di package.json. */
const DEV_PORT = process.env.DEV_PORT ?? "3333";

/**
 * Mengembalikan daftar PID yang listen di DEV_PORT.
 * `null` berarti pemeriksaan tidak bisa dilakukan (alat tidak ada / gagal),
 * dan pemanggil harus memperlakukan ini sebagai "tidak ada konflik" supaya
 * deploy tidak pernah gagal karena guard ini.
 */
function listeningPids() {
  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${DEV_PORT}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out.length > 0 ? out.split("\n").filter(Boolean) : [];
  } catch (error) {
    // lsof keluar dengan status 1 saat tidak ada yang listen — itu normal.
    // Selain itu (mis. ENOENT karena lsof tidak terpasang), anggap tidak tahu.
    if (error?.status === 1) return [];
    return null;
  }
}

const pids = listeningPids();

if (pids === null) {
  // Tidak bisa memastikan; lanjutkan build agar tidak memblokir deploy.
  process.exit(0);
}

if (pids.length > 0) {
  console.error(
    [
      "",
      `Dev server masih berjalan di port ${DEV_PORT} (PID: ${pids.join(", ")}).`,
      "",
      "`next dev` dan `next build` memakai folder .next yang sama, jadi",
      "menjalankannya bersamaan akan merusak .next dan memicu error",
      '"Cannot find module \'./NNNN.js\'" yang menyesatkan.',
      "",
      "Cara mengatasi:",
      `  1. Hentikan dev server:  kill ${pids.join(" ")}`,
      "  2. Jalankan build lagi:  npm run build",
      "",
      "Catat juga: proses dev server mungkin sudah tidak dipakai tetapi masih",
      "hidup. Cek dengan `lsof -ti tcp:3333 -sTCP:LISTEN`.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
