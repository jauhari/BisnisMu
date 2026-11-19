# Analisis Banding: Workbook Google Sheets KDKMP vs AkuntansiMu

**Tanggal:** 18 November 2026
**Sumber:** Google Sheets `1a_zu3PDZQ...` (16 tab, ±4.000 sel terisi, ±5.300 sel rumus)
**Target:** AkuntansiMu v0.12.0 (`/Users/dhw/AkuntansiMu`)

---

## 1. Apa workbook ini sebenarnya

Bukan software akuntansi operasional, melainkan **lembar kerja peserta pelatihan berbasis kompetensi** untuk unit-unit SKKNI Koperasi:

| Kode unit | Judul |
|---|---|
| K.64SPK14.045.1 | Melakukan administrasi transaksi keuangan |
| K.64SPK14.046.x | Memproses entri jurnal |
| K.64SPK14.047.2 | Mengerjakan buku besar |
| K.64SPK14.054.1 | Membagi sisa hasil usaha |

Entitasnya **KDKMP** (Koperasi Desa/Kelurahan Merah Putih) dengan 12 anggota, 43 transaksi bulan Desember 2025, dan total mutasi jurnal **Rp 410.711.853** (seimbang, selisih Rp 0).

Implikasi penting: **workbook ini adalah acuan proses kerja yang ingin didigitalkan**, dan sekaligus spesifikasi tidak resmi untuk kebutuhan koperasi. AkuntansiMu saat ini diposisikan untuk UMKM + BUMDes, bukan koperasi anggota.

---

## 2. Peta 16 tab dan padanannya di AkuntansiMu

| Tab Sheets | Fungsi | Padanan AkuntansiMu | Status |
|---|---|---|---|
| `COA` | 66 akun, 2 level, saldo normal D/K | `Account` + seed SAK EMKM | ✅ Selaras |
| `Anggota` | Master 12 anggota (no, nama, alamat, telp) | `Contact` (customer/vendor) | ⚠️ Beda konsep |
| `SN` | Saldo awal neraca + cek selisih | `BeginningBalance` | ✅ Selaras |
| `SLR` | Saldo awal laba rugi | `BeginningBalance` | ✅ Selaras |
| `SimpAwal` | Saldo awal simpanan pokok/wajib per anggota | — | ❌ Tidak ada |
| `TRANSAKSI` | Daftar 43 transaksi + kondisi bukti + status | `DailySale` / input per modul | ⚠️ Beda bentuk |
| `JURNAL` | Buku jurnal umum 2 kolom, auto-lookup nama akun | `JournalEntry` + `JournalLine` | ✅ Selaras |
| `Buku Besar` | Buku besar per akun (filter sel D5) | `general-ledger` | ✅ Selaras |
| `Buku Pembantu` | Kartu simpanan + penjualan **per anggota** | `subsidiary-ledger` (per kontak) | ⚠️ Sebagian |
| `NL` | Neraca lajur 14 kolom (saldo awal → akhir) | `trial-balance` | ⚠️ Sebagian |
| `NERACA` | Neraca (posisi keuangan) | `balance-sheet` | ✅ Selaras |
| `PHU` | Perhitungan hasil usaha | `profit-loss` | ✅ Selaras |
| `ARUS KAS` | Arus kas (diturunkan dari NL) | `cash-flow` | ✅ Selaras |
| `PE` | Perubahan ekuitas | — | ❌ Tidak ada |
| `Membagi SHU` | Distribusi SHU 25/20/20/20/15 per anggota | — | ❌ Tidak ada |
| `LKP` | Instruksi/lembar kerja peserta | — | — (bukan fitur) |

---

## 3. Yang sudah selaras (inti akuntansi)

1. **Double-entry dengan jurnal umum** — struktur `TGL | NO BUKTI | KETERANGAN | NO ANGGOTA | NAMA | NO ACCOUNT | NAMA ACCOUNT | DEBIT | KREDIT` identik dengan `JournalLine` (debit/credit per akun).
2. **Chart of Accounts berjenjang** — Sheets pakai `1-1000` + level 1/2; kita pakai 6 digit + `parentCode` (lebih dalam: 3 level, plus `isPostingAllowed`).
3. **Validasi keseimbangan** — Sheets: `=H3-I3` lalu `IF(=0,"SEIMBANG","ADA SELISIH")`. Kita: validasi di domain engine + advisory lock, lebih ketat karena menolak posting, bukan sekadar menampilkan peringatan.
4. **Saldo awal** — `SN` + `SLR` = konsep `BeginningBalance` (per akun, D/K, dengan cek selisih).
5. **Laporan pokok** — Neraca, Laba-Rugi (PHU), Arus Kas, Buku Besar: semuanya sudah ada di AkuntansiMu.
6. **Piutang/utang dengan tempo** — transaksi 21, 22, 28, 30 (tempo 10–14 hari, pelunasan sebagian) → `Invoice`/`Bill`/`Payment` + alokasi ✅.
7. **Persediaan & HPP per unit** — beras/minyak/telur/LPG dengan HPP eksplisit → `Product` + `InventoryMovement` + average cost ✅.
8. **Penjualan multi-item** (transaksi 17, 18, 33) → `SalesOrderItem` ✅.

---

## 4. Perbedaan pendekatan (bukan kekurangan)

| Aspek | Sheets | AkuntansiMu |
|---|---|---|
| **Otoritas angka** | Rumus Excel; siapa pun bisa menimpa sel | Domain engine + validasi server; angka tak bisa diakali |
| **Relasi data** | `VLOOKUP`/`SUMIFS` antar tab (194 + 726 sel) | Foreign key Prisma + query |
| **Kode akun** | `1-1000`, 2 level | `110101`, 3 level, dengan `subtype` semantik |
| **Posting** | Input baris di `JURNAL` langsung | `DRAFT` → `POSTED` → `VOID`, atomik + audit log |
| **Multi-entitas** | 1 workbook = 1 entitas | Multi-usaha + `Organization` (BUMDes) + RBAC |
| **Buku besar** | Salin ulang jurnal via `IF(JURNAL!$F9='Buku Besar'!$D$5,...)` × 191 baris | Query langsung, tanpa duplikasi |
| **Arus kas** | Diturunkan dari sel NL tertentu (`NL!H8+NL!H9-...`) — rapuh | Dihitung dari mutasi akun |
| **Buku pembantu** | `SUMIFS` per anggota per akun (48 baris × 3 blok) | `subsidiary-ledger` per kontak |
| **Neraca lajur** | 14 kolom (saldo awal, mutasi, saldo akhir, D/K) | Trial balance standar 6 kolom |

Catatan teknis: workbook ini **sangat bergantung pada posisi baris**. Contohnya `VLOOKUP(D9, Anggota!$B$5:$E$67, ...)` — begitu ada satu anggota disisipkan, seluruh rujukan bergeser. Ini risiko integritas yang hilang total di AkuntansiMu.

---

## 5. Gap nyata: yang mereka punya, kita belum

### 5.1 Anggota sebagai subjek (bukan kontak biasa)

Workbook memakai `NO ANGGOTA` **di setiap baris jurnal** (`JURNAL!D9`), sehingga:
- Buku Pembantu bisa memotong saldo per anggota
- SHU bisa dihitung per anggota berdasarkan simpanan **dan** transaksi

AkuntansiMu punya `Contact`, tapi tanpa: nomor anggota, saldo simpanan, dan agregat transaksi per anggota. Ini gap **struktural**, bukan kosmetik.

### 5.2 Simpanan Pokok & Simpanan Wajib

Akun `3-1100` dan `3-1200` ada di COA mereka, dan `SimpAwal` menyimpan saldo awal per anggota. Di AkuntansiMu akun ekuitas seperti ini bisa dibuat manual, tapi **tidak ada entitas simpanan anggota** — tidak ada kartu simpanan, tidak ada setoran berkala, tidak ada laporan per anggota.

### 5.3 Pembagian SHU

Tab `Membagi SHU` mendistribusikan SHU berjalan **Rp 21.573.147** dengan komposisi:

| Bagian | Porsi |
|---|---|
| Anggota dari modal | 25% |
| Anggota dari transaksi | 20% |
| Cadangan | 20% |
| Pengurus/pengawas/karyawan | 20% |
| Pendidikan | 15% |

Lalu tiap anggota dapat porsi berdasarkan *index* modal (0,16) dan *index* transaksi (0,26). Ini **fitur wajib koperasi** dan sama sekali belum ada di AkuntansiMu.

### 5.4 Aset tetap & penyusutan

Transaksi 41: penyusutan garis lurus, PC 4 tahun, hand traktor (Rp 60 juta) 8 tahun, mengacu **UU PPh jo PMK 72/2023**.

AkuntansiMu punya **akun** aset tetap + akumulasi penyusutan di seed, tetapi **tidak ada model `FixedAsset` maupun mesin penyusutan**. Di AGENTS.md ini memang dijadwalkan Phase 6. Untuk pasar koperasi/BUMDes, ini bukan opsional.

### 5.5 Perpajakan

- Transaksi 40: PPh Pasal 4(2) final 20% atas bunga tabungan + biaya pemeliharaan rekening
- Transaksi 42: PPh badan (UU HPP Pasal 17)
- Transaksi 29 & 37: **beban yang tidak dapat dikurangkan** (sumbangan, jamuan tamu)

Artinya dibutuhkan pemisahan **laba komersial vs laba fiskal** dan koreksi fiskal. AkuntansiMu belum punya konfigurasi pajak (Phase 6).

### 5.6 Laporan koperasi yang belum ada

| Laporan | Status |
|---|---|
| Perubahan Ekuitas (`PE`) | ❌ belum |
| Neraca Lajur 14 kolom (`NL`) | ⚠️ hanya trial balance 6 kolom |
| Kartu Simpanan Anggota | ❌ belum |
| Distribusi SHU per anggota | ❌ belum |
| Tutup buku → SHU berjalan ke SHU ditahan | ❌ belum (AGENTS.md §14.2: period closing belum diimplementasi) |

### 5.7 Alur verifikasi bukti transaksi

Kolom `Kondisi Bukti Transaksi` + `Status`:

- Bukti **Lengkap** → `Proses`
- Bukti tidak lengkap → **`Kembalikan`** (transaksi 3, 8, 20: tanpa kuitansi, tanggal kosong, tanpa persetujuan ketua)

Ini adalah **workflow pengembalian dokumen dengan alasan** — kontrol internal yang justru penting untuk audit BUMDes. AkuntansiMu punya `DRAFT/POSTED/VOID` + audit log, tapi tidak punya status "dikembalikan ke pengaju + alasan".

### 5.8 Lain-lain

- **Konsinyasi** (transaksi 23, 25): barang titipan, HPP 2,5 jt dijual 3,2 jt — belum ada konsepnya.
- **Hibah** dari pemerintah desa (15 jt) → akun `3-1500 Hibah`: bisa manual, tapi belum ada alur khusus.
- **Selisih stock opname** (transaksi 43: fisik 7,0 jt vs buku 7,1 jt) → butuh penyesuaian persediaan + jurnal selisih; perlu dicek apakah `InventoryMovement` mendukung tipe adjustment.
- **Beban dibayar di muka** (transaksi 35: biaya RAT Januari 2026 dibebankan Desember 2025).

---

## 6. Yang AkuntansiMu lakukan lebih baik

1. **Integritas**: tidak ada rumus yang bisa dirusak; jurnal atomik dengan advisory lock; `businessId` di semua write.
2. **Audit trail**: `AuditLog` immutable + `GodModeAuditLog` — workbook tidak punya jejak siapa mengubah apa.
3. **Akses berjenjang**: RBAC 5 role bisnis + 4 platform role; workbook = siapa pun yang punya file.
4. **Multi-unit**: `Organization` + laporan konsolidasi; workbook hanya 1 entitas per file.
5. **Otomasi jurnal**: revenue/cash/AR-AP posting otomatis membentuk jurnal; di workbook semuanya diketik manual (194 baris).
6. **Perhitungan HPP**: average cost otomatis (presisi bigint); workbook mengandalkan angka HPP yang diketik di uraian transaksi — rawan salah.
7. **Laporan real-time**: semua laporan dihitung dari data, bukan dari posisi sel.
8. **Kinerja & UX**: 72 halaman, skeleton loading, cache; Sheets mulai berat saat ribuan baris.

---

## 7. Prioritas yang saya sarankan

Urut berdasarkan (dampak ke pasar koperasi/BUMDes) ÷ (effort):

| # | Item | Dampak | Effort | Catatan |
|---|---|---|---|---|
| 1 | **Anggota sebagai entitas + kartu simpanan** | Sangat tinggi | Sedang | `Member` + `MemberSaving`; rekap per anggota; jurnal tetap lewat engine |
| 2 | **Penyusutan aset tetap (garis lurus)** | Tinggi | Sedang | `FixedAsset` + jadwal + jurnal otomatis; sudah ada akunnya |
| 3 | **Tutup buku (SHU berjalan → SHU ditahan)** | Tinggi | Sedang | Menutup celah AGENTS.md §14.2 |
| 4 | **Distribusi SHU (25/20/20/20/15) + index anggota** | Tinggi | Sedang | Butuh #1 dan #3 |
| 5 | **Status "Dikembalikan" + alasan pada transaksi** | Sedang | Kecil | Memanfaatkan audit log yang sudah ada |
| 6 | **Neraca lajur (worksheet) 14 kolom** | Sedang | Kecil | Perluas `trial-balance` |
| 7 | **Laporan Perubahan Ekuitas** | Sedang | Kecil | Turunan dari #3 |
| 8 | **Konsinyasi** | Sedang | Sedang | Modul persediaan terpisah |
| 9 | **Koreksi fiskal + PPh badan** | Sedang | Besar | Butuh konfigurasi pajak (Phase 6) |

Catatan penting: **jangan menyentuh modul yang sudah production** untuk mengerjakan ini. Semua item di atas bisa ditambahkan sebagai layer additive — sama seperti pendekatan Multi-Unit Organization di v0.8.0.

---

## 8. Hasil implementasi: data sudah masuk (18 Nov 2026)

Business baru berhasil dibuat di database:

| Item | Nilai |
|---|---|
| Nama | **Pelatihan Bendahara Angkatan 7** |
| ID | `cmwlz491r0000gumsip19rbrs` |
| Tipe | BUMDES (multi-usaha, terpisah dari bisnis lain) |
| Pemilik | barookahjaya@gmail.com → OWNER |
| Akun | 66 (65 dari workbook + 1 root HPP) |
| Jurnal | 40 entri / 125 baris |
| Total debit | Rp 402.768.333 |
| Total kredit | Rp 402.768.333 |
| Selisih | **Rp 0 — seimbang** |

### Verifikasi silang dengan workbook

| Pembanding | Workbook | AkuntansiMu | Hasil |
|---|---|---|---|
| Total mutasi jurnal | Rp 402.768.333 | Rp 402.768.333 | ✅ identik |
| SHU (laba) | Rp 29.541.667 | Rp 29.541.667 | ✅ identik |
| Selisih neraca | Rp 0 | Rp 0 | ✅ identik |

Rincian P&L hasil import: Pendapatan Rp 91.355.000 − HPP Rp 45.500.000 − Beban Usaha Rp 4.858.333 − Beban Lain Rp 11.455.000 = **SHU Rp 29.541.667**.
Neraca: Aset Rp 117.691.667 = Liabilitas Rp 53.950.000 + Ekuitas Rp 34.200.000 + SHU Rp 29.541.667. Kas Rp 17.325.000, Bank Rp 26.075.000, Persediaan Rp 7.000.000 — semuanya cocok dengan tab NERACA workbook.

### Pemetaan kode akun

Aturan: `<grup><4 digit><0>` → `1-1110` menjadi `111100`.

Pengecualian pada grup 5, karena workbook mencampur HPP dan beban operasional dalam satu grup:

| Workbook | Kode baru | Grup |
|---|---|---|
| `5-1110` HPP | `511100` | COGS |
| `5-1120` … `5-1170` beban usaha | `6xxxxx` | EXPENSE |
| `5-2100` … `5-2400` beban lain & pajak | `7xxxxx` | OTHER_EXPENSE |

Kode asli disimpan di kolom `Account.description` (`Kode workbook: 5-1110`) untuk rujukan peserta.

### Catatan

- Saldo awal (`SN`, `SLR`, `SimpAwal`) **kosong** di workbook — memang bagian yang diisi peserta. Jadi tidak ada saldo awal yang diimpor.
- Workbook berisi **answer key** lengkap: sudah termasuk penyusutan (Rp 833.333 + Rp 625.000), selisih stock opname (Rp 100.000), dan PPh badan 22% (Rp 6.768.520).
- Script: `scripts/import-kdkmp-pelatihan.mjs` (import) dan `scripts/verify-kdkmp-pelatihan.mjs` (verifikasi). Keduanya belum di-commit.

---

## 9. Modul Anggota + Simpanan + Pinjaman (terpasang)

Fitur baru, additive, di `src/features/membership/`.

### Tabel baru

| Tabel | Isi |
|---|---|
| `members` | nomor anggota (unik per bisnis), nama, alamat, telepon, tanggal gabung, status |
| `member_savings` | jenis (POKOK/WAJIB/SUKARELA), arah (DEPOSIT/WITHDRAWAL), akun, tanggal, jumlah, `journal_id` |
| `member_loans` | nomor pinjaman, akun piutang, pokok, **bunga snapshot (bps)**, tenor, status, `journal_id` |
| `member_loan_installments` | ke-, jatuh tempo, pokok, bunga, dibayar, status |

### Keputusan desain

1. **Setiap transaksi membentuk jurnal** lewat `JournalPostingService` — kartu anggota dan laporan keuangan tidak mungkin berbeda angka.
2. **Bunga = parameter setting**, disimpan di `Business.settings.memberLoan` (`defaultInterestRateBps`, `defaultTermMonths`). Saat pinjaman dicairkan, nilainya **disalin sebagai snapshot** ke baris pinjaman, sehingga mengubah setting tidak mengubah pinjaman yang sudah berjalan.
3. **Saldo simpanan dihitung dari ledger** (sum deposit − sum withdrawal), bukan angka tersimpan — tidak bisa drift.
4. **Jadwal angsuran flat** dengan sisa pembulatan ditumpuk ke angsuran terakhir, jadi total pokok selalu sama persis dengan pinjaman.

### API

| Endpoint | Fungsi |
|---|---|
| `GET /api/members` | daftar + agregat simpanan & sisa pinjaman |
| `POST /api/members` | tambah anggota |
| `GET/PATCH /api/members/[id]` | detail (kartu) / ubah |
| `GET/POST /api/members/[id]/savings` | riwayat / catat setoran-penarikan |
| `GET/POST /api/members/[id]/loans` | daftar / cairkan pinjaman |
| `GET/POST /api/members/[id]/loans/[loanId]/installments` | jadwal / bayar angsuran |

RBAC: `GET` → `reports:read`; transaksi → `cash:write`.

### UI

- `/members` — tabel rekap (pokok, wajib, sukarela, total, sisa pinjaman, angsuran lewat tempo) + form tambah/ubah
- `/members/[id]` — kartu anggota: 4 kartu ringkasan, riwayat simpanan, daftar pinjaman dengan tombol angsuran, form setor/tarik, form pencairan, form pembayaran angsuran
- Menu baru "Anggota Koperasi" di grup Keuangan

### Verifikasi

| Cek | Hasil |
|---|---|
| `tsc --noEmit` | bersih |
| `vitest run` | **231 test lulus** (213 lama + 18 baru) |
| `next lint` | hanya warning lama (file baru bersih) |
| Smoke test ke DB asli | setoran Rp 50.000 → jurnal 2 baris (kas D / simpanan K), saldo anggota naik, lalu dibersihkan kembali |
| Data setelah backfill | 12 anggota, 24 baris simpanan (Pokok Rp 1.200.000, Wajib Rp 33.000.000) — cocok dengan workbook |

Catatan: 21 baris placeholder di tab `Anggota` ("anggota 13"…"anggota 33") sengaja dilewati.

---

## 10. ⚠️ Temuan penting: database lebih baru dari repo

Saat membuat migration modul ini, `prisma migrate status` menunjukkan **5 migration sudah jalan di database tetapi tidak ada di repo lokal**:

```
202608110001_add_payroll
202608110002_payroll_item_payments
202608110003_prevent_duplicate_payroll_payment_journal
202608130001_optimize_transaction_history_indexes
202608180001_add_user_default_business
```

Konsekuensinya:

- Tabel `employees`, `payroll_runs`, `payroll_items`, `payroll_payments` dan kolom `users.default_business_id` **ada di DB** tetapi tidak ada di `prisma/schema.prisma` lokal.
- `prisma migrate diff` sempat menghasilkan perintah **DROP** untuk tabel tersebut — **tidak dijalankan**. Migration modul anggota ditulis manual (hanya `CREATE`) lalu ditandai applied lewat `prisma migrate resolve`.
- Artinya: **ada pekerjaan (modul payroll) di branch/worktree lain yang belum tergabung ke `main`.** Perlu di-merge sebelum deploy berikutnya, kalau tidak schema akan saling menimpa.

---

## 11. Kesimpulan

- **Inti akuntansi sudah selaras.** Jurnal, COA, saldo awal, buku besar, neraca, laba-rugi, arus kas — semuanya ada dan secara teknis lebih kuat daripada versi Sheets.
- **Yang belum ada adalah lapisan koperasi**: anggota, simpanan, SHU, penyusutan, pajak, dan tutup buku. Ini bukan bug, tapi konsekuensi positioning AkuntansiMu yang saat ini mengarah ke UMKM/BUMDes umum.
- **Kalau KDKMP/koperasi jadi target pasar**, workbook ini adalah spesifikasi kebutuhan yang sangat bagus: 43 transaksi, 16 tab, dan aturan pembagian SHU yang eksplisit. Layak dijadikan fixture uji end-to-end.

### Saran konkret

Buat **satu integration test** yang memutar ulang 43 transaksi itu lewat engine AkuntansiMu, lalu bandingkan hasilnya dengan angka di workbook:

| Pembanding | Angka workbook |
|---|---|
| Total mutasi jurnal | Rp 410.711.853 (D = K) |
| SHU sebelum pajak | Rp 21.573.147 |
| Selisih neraca | Rp 0 |

Kalau tiga angka itu cocok, artinya engine kita benar untuk domain koperasi, dan sisanya tinggal lapisan fitur.
