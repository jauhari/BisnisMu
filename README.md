# BisnisMu

BisnisMu adalah aplikasi akuntansi web untuk UMKM dan BUMDes dengan fokus pada pencatatan jurnal, bagan akun SAK EMKM, laporan keuangan, serta workflow operasional usaha.

## Update Terbaru

- **Login production diperbaiki (v0.11.1):** form login memakai better-auth (`/api/auth/sign-in/email`) + bootstrap usaha aktif; cookie sesi ditangani dengan benar sehingga tidak langsung redirect balik ke halaman login.
- Riwayat Transaksi menyatukan Penjualan Harian, Sales Order, dan Transaksi Kas dengan aksi role-based untuk edit, delete, void, post, dan confirm.
- Organisasi tertentu dapat mengaktifkan mode edit/delete langsung untuk transaksi posted/confirmed lewat setting `transactionHardMutationEnabled`.
- Form Penjualan Harian kini default tersembunyi, dibuka lewat tombol `Tambah penjualan`, dan layoutnya lebih ringkas untuk layar kecil.
- Pemilihan akun CoA memakai query field cerdas: ketik nama/kode akun, hasil dibatasi maksimal 5, dan daftar tidak tampil sebelum user mencari.
- Tabel data memakai format tanggal lokal Indonesia, tampilan akun fokus ke nama akun, dan warna grup per tanggal agar data lebih mudah dipindai.
- Jurnal manual mendukung alur `Draft` dan `Posted`; jurnal posted dikoreksi lewat `Reverse` dan `Copy as new`, bukan diedit langsung.
- Form jurnal menampilkan nominal dengan pemisah ribuan otomatis dan warna debit/kredit yang lebih jelas.
- Bagan Akun (CoA) tampil sebagai hierarki akun: header/kategori dan akun posting terlihat jelas.
- Form CoA membuat kode akun otomatis berdasarkan grup, induk akun, dan nomor terakhir yang sudah ada.
- Saldo normal akun tampil sebagai informasi otomatis dari grup akun.

## Development

```bash
npm install
npm run typecheck
npm run dev -- --port 3333
```

## Security: secret rotation

`.env` ships with placeholders only. Provide real values via your secrets manager
(Vercel env vars / Neon dashboard), never commit them. If any of the following were
ever exposed in a developer `.env`, rotate them:

- `DATABASE_URL` / `DIRECT_URL` — reset the Neon database password.
- `ANTHROPIC_API_KEY` — revoke and reissue in the Anthropic console.
- `BETTER_AUTH_SECRET` — regenerate with `openssl rand -base64 32` (rotating this
  invalidates existing sessions).

Lihat `CHANGELOG.md` untuk riwayat perubahan lengkap.
