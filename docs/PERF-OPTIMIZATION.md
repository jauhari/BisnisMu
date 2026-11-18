# Optimasi Performa — Analisis & Tindakan

**Tanggal:** 18 November 2026
**Target:** `https://www.bisnismu.net` (produksi)

---

## 1. Baseline terukur (sebelum optimasi)

Diukur dengan `scripts/bench-routes.mjs` (median 3 sampel, request berurutan):

| Route | Median | min | max |
|---|---:|---:|---:|
| `doc /login` | 52 ms | 43 ms | 408 ms |
| `doc /dashboard` | **5.953 ms** | 3.142 ms | 6.524 ms |
| `doc /accounting/journals` | 2.929 ms | 2.907 ms | 3.113 ms |
| `api /health` (hanya `SELECT 1`) | 1.426 ms | 1.414 ms | 4.989 ms |
| `api /auth/me` | **4.032 ms** | 4.022 ms | 4.547 ms |
| `api /auth/businesses` | 2.174 ms | 1.895 ms | 3.338 ms |
| `api /accounting/chart-of-accounts` | 3.110 ms | 3.023 ms | 4.355 ms |
| `api /members` (12 baris) | 3.993 ms | 3.977 ms | 4.202 ms |

Pembanding penting: `/login` (statis, dari CDN) hanya **52 ms**. Jadi masalahnya bukan hosting file, melainkan eksekusi server + query.

---

## 2. Akar masalah

### 2.1 Fungsi dan database beda benua (penyebab terbesar)

```
x-vercel-id: sin1::iad1::...
                   ↑ fungsi dieksekusi di iad1 (Virginia, AS)

DATABASE_URL → ep-...ap-southeast-1.aws.neon.tech  (Singapore)
```

Setiap query menempuh ±250 ms. Satu request API melakukan 4–8 query, jadi 1–2 detik habis murni di jaringan sebelum logika apa pun berjalan.

Bukti: `/api/health` yang isinya hanya `SELECT 1` butuh **1.426 ms**. Dari mesin lokal (Indonesia → Singapore) query yang sama hanya 150–230 ms.

### 2.2 Autentikasi diperiksa 2–4 kali per request

`middleware.ts` melakukan 2 query (session+user, businessMember), lalu route handler mengulang 2 query yang sama lewat `requireTenantContext()`. `React.cache` tidak menyeberang dari middleware ke handler.

### 2.3 Hampir semua halaman adalah client component

67 dari 75 halaman `"use client"`. Akibatnya tiap halaman butuh dua perjalanan: dokumen HTML (server) **lalu** fetch API dari browser — dan fetch itu masuk ke invokasi fungsi baru (cold start + query auth lagi).

### 2.4 Shell memanggil 2 API di setiap halaman

`AppShell` memanggil `/api/auth/me` dan `/api/auth/businesses` pada setiap pemuatan halaman. Digabung dengan data halaman, satu tampilan = 3 API call.

### 2.5 Cold start

`/api/health` konsisten ±1,4 detik meski dipanggil berulang. Untuk `SELECT 1` di region yang sama seharusnya 50–100 ms. Indikasi kuat setiap request membayar cold start fungsi.

### 2.6 Bundle

Total 4,7 MB JS. Chunk terbesar: `xlsx` 404 KB, `recharts` 380 KB, `jspdf`+`html2canvas` 324 KB. `xlsx` dan `jspdf` sudah dynamic; **recharts masih statis** di 7 halaman dashboard + 2 halaman laporan.

Yang **bukan** masalah: tabel sudah virtualized (30 baris), QueryClient sudah `staleTime 30s` + `refetchOnWindowFocus: false`, dan trace render dashboard menunjukkan **0 long task** (maks 18 ms). Kelambatan bukan di JavaScript browser.

---

## 3. Tindakan yang dikerjakan

| # | Tindakan | File | Status |
|---|---|---|---|
| 1 | Konteks auth diteruskan dari middleware lewat header tepercaya; handler tidak query DB ulang. 2 query auth digabung jadi 1. | `middleware.ts`, `src/presentation/auth/session.ts` | selesai |
| 2 | Data user + daftar bisnis dikirim dari layout (RSC) sebagai props; shell tidak lagi memanggil `/api/auth/me` dan `/api/auth/businesses`. | `app/(app)/layout.tsx`, `components/layout/app-shell.tsx` | selesai |
| 3 | recharts dikeluarkan dari bundle awal lewat wrapper `next/dynamic` + skeleton. | `components/charts/lazy-charts.tsx` + 7 halaman | selesai |
| 4 | Harness benchmark agar sebelum/sesudah terukur. | `scripts/bench-routes.mjs` | selesai |

---

## 4. Yang belum bisa dikerjakan dari kode (butuh keputusan Anda)

### 4.1 Region — dampak terbesar

Pilih salah satu:

**Opsi A — fungsi ikut ke Singapore (butuh Vercel Pro).**
Tambahkan ke `vercel.json`:

```json
{
  "regions": ["sin1"],
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build",
  "framework": "nextjs"
}
```

Perkiraan: setiap query turun dari ±250 ms ke ±2–5 ms. Untuk request dengan 6 query, hemat ±1,5 detik.

**Opsi B — database ikut ke AS (tanpa upgrade).**
Buat project/branch Neon di `us-east-1`, migrasikan data, ganti `DATABASE_URL` + `DIRECT_URL`. Perkiraan hemat sama besarnya.

**Opsi C — biarkan, andalkan pengurangan query + cache.**
Hemat lebih kecil (±0,5–1 detik per request), tapi tanpa biaya/perubahan infrastruktur.

### 4.2 Konversi halaman baca ke RSC

Dashboard sudah RSC (dan itu yang tercepat). Halaman baca lain (jurnal, laporan, daftar) masih client. Konversi bertahap akan menghapus satu round trip per halaman — pekerjaan menengah, sebaiknya per modul dengan review.

### 4.3 Cold start

Kalau trafik masih jarang, fungsi tetap dingin. Pilihan: upgrade plan (instance lebih hangat), atau biarkan karena setelah 4.1+4.2 dampaknya mengecil.

---

## 5. Cara mengukur ulang

```bash
# buat sesi uji (atau pakai cookie browser Anda)
node scripts/bench-routes.mjs https://www.bisnismu.net <session-token> 3
```

Angka baseline tersimpan di `/tmp/bench-before.txt` saat sesi optimasi ini berjalan.
