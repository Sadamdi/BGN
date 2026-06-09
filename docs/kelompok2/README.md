# Dokumentasi Fitur Kelompok 2 — SIPGN-BGN

> **Project**: SIPGN-BGN (Sistem Informasi Pemenuhan Gizi Nasional — Badan Gizi Nasional)
> **Kelompok**: 2
> **Fitur yang dikerjakan**: Nilai Gizi + List Makanan Weekly, Laporan Kinerja per SPPG, Manajemen Penerima Manfaat.

---

## Daftar Isi

1. [Nilai Gizi & List Makanan Weekly](./01-nilai-gizi-weekly-menu.md)
2. [Laporan Kinerja per SPPG](./02-laporan-kinerja-sppg.md)
3. [Manajemen Penerima Manfaat](./03-penerima-manfaat.md)
4. [Alur Data Lintas Page](./04-data-flow.md)
5. [Q&A untuk Presentasi Dosen](./05-jawaban-dosen.md)
6. [Troubleshooting & FAQ](./06-troubleshooting.md)

---

## Ringkasan Fitur

| # | Fitur | SRS Reference | Endpoint Inti | Halaman Frontend |
|---|-------|---------------|---------------|------------------|
| 1 | **Nilai Gizi & List Makanan Weekly** | REQ-4.1, REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5 | `POST /api/distribusi`, `POST /api/gizi`, `GET /api/dashboard/tren-distribusi` | `DistribusiListPage`, `DistribusiFormPage`, `GiziFormPage`, `DashboardPage` |
| 2 | **Laporan Kinerja per SPPG** | REQ-3.4, REQ-6.1, REQ-6.2, REQ-6.3 | `POST /api/laporan/kinerja-sppg/preview`, `POST /api/laporan/kinerja-sppg/excel` | `LaporanPage` (tab Kinerja SPPG) |
| 3 | **Penerima Manfaat** | REQ-2.1, REQ-2.2, REQ-2.4, REQ-2.5, REQ-2.6 | `GET /api/penerima`, `POST /api/penerima`, `POST /api/laporan/penerima/preview` | `PenerimaListPage`, `PenerimaFormPage`, `PenerimaDetailPage` |

---

## Tech Stack Implementasi

| Layer | Tools |
|-------|-------|
| Backend runtime | Node.js 20+ LTS |
| Framework | Express 4 |
| ORM | Prisma 5 + PostgreSQL 15 |
| Auth | JWT + bcrypt (cost 12) + Redis (Upstash) untuk blacklist & lockout |
| Realtime | Socket.IO + Redis pub/sub |
| Cron | Vercel Cron `0 17 * * *` UTC (= 00:00 WIB) |
| Frontend | React 18 + Vite + Ant Design 5 + Recharts 2 |
| Map | React-Leaflet 4 + OpenStreetMap |

---

## Anggota Kelompok 2

| Nama | NIM | Peran |
|------|-----|-------|
| Sulthan Adam Rahmadi | 240605110109 | Project Manager, Frontend, Backend |
| Irfan Satya Abinaya | 240605110095 | Developer |
| Rahmat Rafi Indrayani | 240605110157 | Developer |
| Ahmad Zamroni | 240605110216 | Developer |
| M Fajar Maulana Afidiyanto | 240605110207 | Developer |
| Muhammad Nailul Ghufron Majid | 240605110160 | Developer |
| Yusuf Maulana Nur Rasidi | 240605110111 | Developer |

---

## Cara Verifikasi Setelah Deploy

1. Login ke `https://bgn-xi.vercel.app` dengan `admin / Admin@123!`
2. Buka **Dashboard** -> lihat tren distribusi 30 hari, cakupan, alert gizi
3. Buka **Distribusi MBG** -> lihat proporsi kategori penerima per SPPG
4. Buka **Laporan > Kinerja SPPG** -> lihat paginated 3.354 SPPG dengan rata-rata distribusi & realisasi
5. Buka **Laporan > Status Gizi** -> lihat nama Indonesia + Z-score varied
6. Buka **Laporan > Penerima** -> lihat preview faker-id names
7. Buka **SPPG** -> lihat kapasitas realistis & distribusi kemarin per SPPG
