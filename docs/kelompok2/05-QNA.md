# Q&A untuk Presentasi Dosen

Daftar pertanyaan yang sering ditanyakan dosen saat presentasi Software Engineering, dengan jawaban siap pakai untuk proyek SIPGN-BGN.

---

## Requirement Engineering

**Q: Ceritakan Requirement Engineering process untuk proyek ini?**
A: Kami jalani 6 tahap RE:
1. **Inception** - identifikasi masalah BGN (Rp71T anggaran, 15jt+ penerima, 5.000 SPPG, fragmentasi data).
2. **Elicitation** - klasifikasi kebutuhan jadi REQ (fungsional), NFR (performa, keamanan), BR (bisnis).
3. **Elaboration** - REQ jadi spesifikasi teknis di Bab 3-6 SRS.
4. **Negotiation** - prioritas High/Medium/Low; trade-off (Hobby plan Vercel 1x/hari cron).
5. **Specification** - dokumen SRS formal IEEE 830-based.
6. **Validation** - checklist Appendix D (completeness, consistency, feasibility, unambiguity, testability).

**Q: Kenapa SRS pakai IEEE 830?**
A: IEEE Std 830-1998 adalah recommended practice untuk SRS, memberikan struktur baku (Introduction, Overall Description, External Interface, System Features, Nonfunctional Requirements) yang widely accepted. Appendix D checklist memastikan completeness + consistency + testability.

**Q: Kebutuhan mana yang prioritas High?**
A: 6 fitur utama (F1-F6) semua prioritas High: Dashboard Monitoring, Manajemen Penerima, Manajemen SPPG, Distribusi MBG, Pemantauan Status Gizi, Pelaporan. Karena BGN butuh operasional end-to-end sebelum basic GA.

---

## Arsitektur & Tech Stack

**Q: Kenapa pilih Vercel + Node + Postgres?**
A: Vercel untuk frontend (free, CDN global, Vite optimization) + serverless function. Postgres karena data relasional dengan relasi kompleks (1 SPPG punya N penerima & N distribusi). Prisma ORM untuk type-safety. Redis untuk cache + Socket.IO pub/sub. Ikut rekomendasi SRS Bab 6.2.

**Q: Kenapa Vercel serverless bukan VM?**
A: Vercel Hobby = free. Trade-off: function 5 menit timeout, cold start 1-3 detik. Solusi: 1) backend `maxDuration: 300` (di vercel.json), 2) cron Vercel `0 17 * * *` UTC untuk harian, 3) batch insert paralel.

**Q: Jelaskan layered architecture!**
A: 3 lapisan:
- **Frontend (React+Vite SPA)**: komponen UI, form, chart. Ant Design 5 + Recharts 2 + React-Leaflet 4. Axios untuk HTTP, Zustand untuk state.
- **Backend (Express REST API)**: middleware (auth JWT, RBAC, rate limit, audit), service layer (bisnis logika), controller (HTTP adapter), Prisma ORM.
- **Storage**: PostgreSQL (data utama), Redis (cache & session & blacklist token & lockout login), object storage (upload foto bukti).

---

## Fitur 1: Nilai Gizi & List Makanan Weekly

**Q: Standar WHO yang dipakai?**
A: WHO 2006 (untuk balita 0-59 bulan) & WHO 2007 (untuk anak sekolah). Formula LMS:
Z = ((y/M)^L - 1) / (L × S)
Tabel LMS disimpan di `backend/src/data/who/*.json` (L, M, S per indeks WHO). Klasifikasi REQ-5.3: Z<-3 BURUK, -3..-2 KURANG, -2..+2 BAIK, >+2 LEBIH. Stunting = TB/U < -2 SD.

**Q: Kenapa pakai Acuan Isi Piringku?**
A: 50% sayur+buah, 50% karbo+protein adalah standar Kemenkes RI untuk menu MBG (lihat Permenkes). Generator `buildMenuTemplate()` di `dummyNutrition.service.js` mengikuti proporsi ini. Komposisi: 1 karbo + 1 protein hewani + 1 nabati + 1-2 sayur + 1 buah + 75% ada pelengkap.

**Q: Bagaimana menu weekly disimpan?**
A: Tidak ada tabel menu terpisah. Menu disimpan sebagai JSON di field `catatan` per row `distribusi_mbg`. Schema: `{menuHarian: {...}, menuMingguan: {senin..minggu: [...]}, averageEnergyPerPortion: 723}`. Seed deterministic (`hashString(sppgId|week|dayKey)`) sehingga menu konsisten per SPPG per minggu.

**Q: Kalau Z-score out of range?**
A: Sistem reject dengan error message (BR-3: BB 0-300, TB 30-250, LILA 5-50). Lihat `zscore.service.js` untuk handling error.

---

## Fitur 2: Laporan Kinerja per SPPG

**Q: Kenapa pakai pagination 25?**
A: Vercel Hobby max function 5 menit. Tanpa pagination: 3.354 SPPG + 30 hari distribusi = 100.620 row, query berat. Pagination 25 + summary agregat DB di luar paginated rows -> konsisten (summary akurat meskipun user lihat 25 row).

**Q: Bagaimana hitung Realisasi %?**
A: `effectiveCapacity = max(sppg.kapasitasPorsiPerHari, max(25, count(penerima_aktif)))`. `rata-rata/hari = sum(totalPorsi 30 hari) / count(distinct tanggal)`. `realisasi % = (rata-rata / effectiveCapacity) × 100`.

**Q: Kenapa semua SPPG awalnya Realisasi 53%?**
A: Awalnya `buildCategoryAllocation` deterministic (seeded `sppgId|date`) menghasilkan totalRecords identik per tanggal. Sudah ditambah per-SPPG jitter di `computeEffectiveCapacity` (±15%) + util 35-90% kapasitas. Sekarang Realisasi bervariasi 30-90% per SPPG.

---

## Fitur 3: Penerima Manfaat

**Q: Kenapa NIK dienkripsi?**
A: UU PDP No. 27/2022 mewajibkan data pribadi sensitif (termasuk NIK) dienkripsi. Kami pakai AES-256-GCM (authenticated encryption standar industri). Untuk equality search yang butuh pencocokan NIK, kami pakai HMAC-SHA256 deterministic hash yang di-index. Tampilan di UI selalu masked (`1234********5678`).

**Q: Mengapa butuh `nikHash` & `nikEnc`?**
A: AES-GCM itu authenticated encryption dengan IV random, **tidak bisa dipakai untuk equality lookup** (ciphertext beda tiap insert). HMAC-SHA256 deterministic memungkinkan index-based search tanpa expose NIK asli. Index `@@unique([nikHash, sppgId])` di level DB.

**Q: Bagaimana soft delete?**
A: `statusAktif=false` bukan `DELETE FROM`. BR-2 & REQ-2.5: data non-aktif TIDAK hilang dari database, hanya tersembunyi dari daftar aktif. Audit trail & histori gizi terjaga.

---

## Keamanan

**Q: Bagaimana rate limit?**
A: `middleware/rateLimiter.js`: global 1000 request/menit per IP, login 10 percobaan/15 menit. Hash password bcrypt cost 12 (standar). NIK AES-256-GCM (UU PDP). JWT expiry 8 jam access + 7 hari refresh.

**Q: RBAC gimana?**
A: 5 role: ADMIN, PEJABAT_BGN, PENGAWAS_GIZI (per zona), OPERATOR_SPPG (per SPPG), ASISTEN_LAPANGAN. Backend `requireRole(...)` + `buildSppgFilter(user)` filter data sesuai akses user. Operator hanya lihat SPPG sendiri, Pengawas hanya zona sendiri.

---

## Data Dummy

**Q: Kenapa data dummy?**
A: Karena data riil BGN tidak tersedia untuk development/demo, kami generate data realistic via `dummyNutrition.service.js` dengan seeded random. Aman di-rerun (upsert + skipDuplicates). Backfill SPPG: kapasitas 200-5000 deterministic + 12-20 penerima dummy per SPPG.

**Q: Kenapa mode realistic vs absurdly_high?**
A: Mode realistic (default cron harian): nasional 1.000-1.000.000 porsi/hari, representatif produksi. Mode absurdly_high: util 35-90% kapasitas, chart besar untuk demo visual presentasi.

**Q: Kenapa distribusi hari ini bisa 0 padahal data ada?**
A: Ini masalah timezone mismatch. Server Vercel region `iad1` berjalan di UTC, sedangkan generator menyimpan data dalam timezone Asia/Jakarta (WIB). Sebelum fix, `startOfDay(new Date())` di server UTC menghasilkan midnight UTC (`2026-06-10T00:00:00Z`), sedangkan row distribusi 10 Juni WIB disimpan sebagai `2026-06-09T17:00:00Z` (UTC). Keduanya tidak match. Fix: `dateRange.js` diubah agar `startOfDay`, `endOfDay`, `rangeArray` selalu konversi ke WIB dulu sebelum ambil midnight, sehingga `startOfDay(now)` = `2026-06-09T17:00:00Z` (awal hari WIB) = same as generator.

**Q: Kenapa tren 30 hari tidak penuh (banyak hari 0)?**
A: Cron Vercel Hobby limit 1x/hari — hanya generate 3 slice (kemarin/hari ini/besok). Historis 30 hari ke belakang harus di-backfill manual: klik tombol **Backfill 30 Hari (Realistis)** di dashboard, atau **Reset Data Dummy** (yang otomatis trigger backfill). Setelah itu cron harian otomatis extend satu hari ke depan setiap hari.

---

## Testing

**Q: Status test?**
A: Backend Jest: 7 pass, 2 fail. Frontend Jest: 2 pass, 2 fail. Coverage global: 80% lines/statements target. Failures prioritas Sprint 3 (perbaiki fixture z-score, mock import.meta, transform Jest).

**Q: Apa prioritas berikutnya?**
A: Stabilitas test (zero fail), tambah integration test untuk laporan Excel/PDF, E2E test Playwright untuk dashboard realtime.

---

## Demonstrasi Live

**Q: Bisa demo?**
A: Ya, `https://bgn-xi.vercel.app` dengan `admin / Admin@123!`:
1. Dashboard -> lihat tren 30 hari, cakupan nasional, alert gizi
2. Tombol "Generate Data Harian" / "Trigger Cron" -> populate data
3. Laporan > Kinerja SPPG -> 3.354 SPPG paginated
4. Laporan > Status Gizi -> Z-score varied
5. SPPG list -> distribusi kemarin per SPPG
6. Penerima Manfaat -> NIK masked, search by name
