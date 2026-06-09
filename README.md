# BisnisMu

BisnisMu adalah aplikasi akuntansi web untuk UMKM dan BUMDes dengan fokus pada pencatatan jurnal, bagan akun SAK EMKM, laporan keuangan, serta workflow operasional usaha.

## Update Terbaru

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