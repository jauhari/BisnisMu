# BisnisMu

BisnisMu adalah aplikasi akuntansi web untuk UMKM dan BUMDes dengan fokus pada pencatatan jurnal, bagan akun SAK EMKM, laporan keuangan, serta workflow operasional usaha.

## Update Terbaru

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

Lihat `CHANGELOG.md` untuk riwayat perubahan lengkap.
